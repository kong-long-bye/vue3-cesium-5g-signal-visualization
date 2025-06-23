<template>
  <div ref="cesiumContainer" id="cesiumContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as Cesium from 'cesium'
import { useBaseStationStore } from '../stores/baseStations'
import { nanoid } from 'nanoid'
import {type Building, type SignalStrengthResult} from '../types.ts'
import { calculateBestSignal,   } from '../utils/propagationModels'
import { AntennaRayVisualization } from '../utils/antennaVisualization'
import { ThreeJSRayTracingManager } from '../utils/threejsRayTracing'
import { useBuildingStore } from '../stores/buildings'
import { getBuildingMaterial } from '../utils/buildingMaterials'
import {getWallPenetrationDetector} from "../utils/wallPenetrationDetector.ts";
const store = useBaseStationStore()
const buildingStore = useBuildingStore()

const cesiumContainer = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer


// 显示信号强度信息窗口
function showSignalStrengthInfo(
    lon: number,
    lat: number,
    height: number,
    results: SignalStrengthResult[]
) {
  // 移除之前的查询结果
  const existingEntity = viewer.entities.getById('signal-query-result')
  if (existingEntity) {
    viewer.entities.remove(existingEntity)
  }

  // 创建信息内容
  const bestSignal = results[0]
  const stationName = store.stations.find(s => s.id === bestSignal.stationId)?.name || '未知基站'
  // 构建简洁的信息文本，避免过长导致截断
  let infoText = `信号强度查询\n`
  infoText += `坐标: ${lat.toFixed(6)}°, ${lon.toFixed(6)}°\n\n`
  infoText += `最强信号:\n`
  infoText += `基站: ${stationName}\n`
  infoText += `RSSI: ${bestSignal.rssi.toFixed(2)} dBm\n`
  infoText += `距离: ${bestSignal.distance.toFixed(1)} m\n`
  infoText += `路径损耗: ${bestSignal.pathLoss.toFixed(2)} dB\n`
  infoText += `传播模型: ${bestSignal.model}\n`

  if (results.length > 1) {
    infoText += `\n其他信号源 (${results.length - 1}个):\n`
    results.slice(1, 4).forEach((result, index) => {
      const station = store.stations.find(s => s.id === result.stationId)
      infoText += `${index + 2}. ${station?.name}: ${result.rssi.toFixed(1)} dBm\n`
    })
  }
// 如果使用AWM模型，显示详细信息
  if (bestSignal.awmDetails) {
    const awm = bestSignal.awmDetails
    infoText += `\n--- AWM模型详情 ---\n`
    infoText += `自由空间损耗: ${awm.breakdown.freeSpaceLoss.toFixed(2)} dB\n`
    infoText += `穿透墙体数: ${awm.penetrationResult.wallCount}\n`
    infoText += `墙体损耗: ${awm.breakdown.wallLoss.toFixed(2)} dB\n`
    infoText += `阴影衰落: ${awm.breakdown.shadowFading.toFixed(2)} dB\n`

    if (awm.penetrationResult.penetratedBuildings.length > 0) {
      infoText += `穿透楼体:\n`
      awm.penetrationResult.penetratedBuildings.slice(0, 3).forEach((building: any, index: number) => {
        infoText += `  ${index + 1}. ${building.building.name} (${building.penetrationPoints}墙)\n`
      })
    }

    // 可视化穿透路径
    const detector = getWallPenetrationDetector(viewer)
    detector.visualizePenetrationPath(awm.penetrationResult, `awm-path-${bestSignal.antennaId}`)

    // 3秒后清除路径可视化
    setTimeout(() => {
      detector.clearVisualization(`awm-path-${bestSignal.antennaId}`)
    }, 5000)
  }

  // 在地图上显示查询点和信息
  viewer.entities.add({
    id: 'signal-query-result',
    position: Cesium.Cartesian3.fromDegrees(lon, lat, height + 2),
    point: {
      pixelSize: 12,
      color: getSignalStrengthColor(bestSignal.rssi),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.NONE
    },
    label: {
      text: infoText,
      font: '11px monospace, Microsoft YaHei, sans-serif', // 使用等宽字体，确保对齐
      pixelOffset: new Cesium.Cartesian2(20, -80), // 适当调整位置
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      // 背景设置 - 关键：给足够空间
      backgroundColor: Cesium.Color.fromCssColorString('rgba(0, 0, 0, 0.9)'),
      backgroundPadding: new Cesium.Cartesian2(25, 15), // 增大内边距，确保文本有足够空间
      showBackground: true,
      // 显示控制
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // 对齐方式
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      // 固定尺寸和位置
      heightReference: Cesium.HeightReference.NONE,
      scale: 1.0,
      // 添加这些属性确保文本完整显示
      eyeOffset: new Cesium.Cartesian3(0, 0, 0),
      pixelOffsetScaleByDistance: undefined, // 禁用像素偏移缩放
      scaleByDistance: undefined, // 禁用距离缩放
      translucencyByDistance: undefined, // 禁用距离透明度

    }
  })

  // 3秒后自动隐藏查询结果
  setTimeout(() => {
    const entity = viewer.entities.getById('signal-query-result')
    if (entity) {
      viewer.entities.remove(entity)
    }
  }, 3000)
}

// 根据信号强度返回颜色
function getSignalStrengthColor(rssi: number): Cesium.Color {
  if (rssi > -60) return Cesium.Color.GREEN        // 极强信号
  if (rssi > -70) return Cesium.Color.LIME         // 强信号
  if (rssi > -80) return Cesium.Color.YELLOW       // 中等信号
  if (rssi > -90) return Cesium.Color.ORANGE       // 弱信号
  if (rssi > -100) return Cesium.Color.RED         // 很弱信号
  return Cesium.Color.GRAY                         // 极弱/无信号
}

// 简单信息显示函数
function showInfoWindow(lon: number, lat: number, message: string) {
  const existingEntity = viewer.entities.getById('info-message')
  if (existingEntity) {
    viewer.entities.remove(existingEntity)
  }

  viewer.entities.add({
    id: 'info-message',
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 10),
    label: {
      text: message,
      font: '12px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE
    }
  })

  setTimeout(() => {
    const entity = viewer.entities.getById('info-message')
    if (entity) viewer.entities.remove(entity)
  }, 7000)
}
// 添加楼体创建函数
function createBuilding(lon: number, lat: number) {
  const id = nanoid()
  const defaultMaterial = getBuildingMaterial('concrete')!

  const newBuilding: Building = {
    id,
    name: `楼体-${id.slice(0, 4)}`,
    longitude: lon,
    latitude: lat,
    height: 30,
    width: 20,
    length: 20,
    floors: 10,
    rotation: 0,
    wallLoss: defaultMaterial.wallLoss,
    roofLoss: defaultMaterial.roofLoss,
    floorLoss: defaultMaterial.floorLoss,
    materialType: 'concrete',
    color: defaultMaterial.color,
    opacity: 0.8
  }

  // 在3D地图中添加楼体
  addBuildingToMap(newBuilding)

  // 保存楼体数据到store
  buildingStore.addBuilding(newBuilding)
  buildingStore.selectBuilding(id)
  buildingStore.setBuildingCreationMode(false) // 创建后退出创建模式
}

// 在地图上添加楼体
function addBuildingToMap(building: Building) {
  const buildingEntity = viewer.entities.add({
    id: building.id,
    position: Cesium.Cartesian3.fromDegrees(building.longitude, building.latitude, 0),
    box: {
      dimensions: new Cesium.Cartesian3(building.width, building.length, building.height),
      material: Cesium.Color.fromCssColorString(building.color).withAlpha(building.opacity),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString(building.color).withAlpha(1.0),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    },
    label: {
      text: `${building.name}\n${building.width}×${building.length}×${building.height}m\n${building.floors}层`,
      font: '12px sans-serif',
      pixelOffset: new Cesium.Cartesian2(0, -building.height/2 - 30),
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  })

  // 设置楼体旋转
  if (building.rotation !== 0) {
    const heading = Cesium.Math.toRadians(building.rotation)
    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0)
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(building.longitude, building.latitude, building.height/2),
        hpr
    )
    buildingEntity.orientation = new Cesium.ConstantProperty(orientation)
  }
}


onMounted(() => {
  if (!cesiumContainer.value) return

  // 初始化Cesium场景
   viewer = new Cesium.Viewer(cesiumContainer.value, {

  })


      const geometricRayVisualization = new AntennaRayVisualization(viewer)
      const threeJSRayTracingManager = new ThreeJSRayTracingManager(viewer)

      // 设置默认视角到重庆市
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(106.6148619 , 29.5391032, 200), // 重庆坐标，高度50km
    orientation: {
      heading: Cesium.Math.toRadians(0),     // 正北方向
      pitch: Cesium.Math.toRadians(-30),     // 俯视角度45度
      roll: 0.0
    }
  })
  // 处理地图点击事件 - 添加基站
  viewer.screenSpaceEventHandler.setInputAction((event:any) => {


    const cartesian = viewer.scene.pickPosition(event.position)
    if (!cartesian) return

    // 转换为经纬度坐标
    const carto = Cesium.Cartographic.fromCartesian(cartesian)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)

    const id = nanoid()
    const defaultHeight = 30 // 默认基站高度30米


    // 检查是否处于楼体创建模式
    if (buildingStore.isCreatingBuilding) {
      createBuilding(lon, lat)
      return
    }
    // 检查是否处于宏站创建模式
    if (!store.isCreatingMode) return
    // 在3D地图中添加基站图标和标签
    viewer.entities.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      billboard: {
        image: '/station-icon1.png',
        scale: 0.1,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: `宏站-${id.slice(0, 4)}\n高度: ${defaultHeight}m`,
        font: '12px sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -40),
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE
      }
    })

    // 添加基站支撑杆（从地面到基站的线条）
    viewer.entities.add({
      id: `${id}_pole`,
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          Cesium.Cartesian3.fromDegrees(lon, lat, defaultHeight)
        ],
        width: 3,
        material: Cesium.Color.GRAY.withAlpha(0.8),
        clampToGround: false
      }
    })

    // 保存基站数据到store
    store.addStation({
      id,
      name: `宏站-${id.slice(0, 4)}`,
      longitude: lon,
      latitude: lat,
      height: defaultHeight,
      antennas: []
    })

    store.selectStation(id)

  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)


  // ========== 新增：射线追踪模式切换事件 ==========
  window.addEventListener('updateRayTracingMode', (event: any) => {
    const { stationId, antennaId, antenna } = event.detail
    const station = store.stations.find(s => s.id === stationId)
    console.log('更新射线追踪模式', antenna.rayTracingType)
    if (station && antenna) {
      // 清除所有射线追踪显示
      geometricRayVisualization.clearAntenna(antennaId)

      threeJSRayTracingManager.clearAntenna(antennaId)

      // 根据选择的模式启用对应的射线追踪
      switch (antenna.rayTracingType) {
        case 'geometric':
          if (antenna.visualization.enabled) {
            geometricRayVisualization.renderAntenna(station, antenna)
          }
          break

        case 'threejs':
          if (antenna.threeJSRayTracing.enabled) {
            threeJSRayTracingManager.enable(antenna.threeJSRayTracing)
            threeJSRayTracingManager.renderAntenna(station, antenna)
          }
          break


      }
    }
  })
      // 添加右键点击事件 - 信号强度查询
  viewer.screenSpaceEventHandler.setInputAction((event:any) => {
    const cartesian = viewer.scene.pickPosition(event.position)
    if (!cartesian) return

    // 转换为经纬度坐标
    const carto = Cesium.Cartographic.fromCartesian(cartesian)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    const height = 1.5 // 默认接收点高度1.5米

    // 计算所有基站天线的信号强度
    const signalResults = calculateBestSignal(store.stations, lat, lon, height,viewer)

    if (signalResults.length === 0) {
      showInfoWindow(lon, lat, '没有可用的基站信号')
      return
    }

    // 显示信号强度查询结果
    showSignalStrengthInfo(lon, lat, height, signalResults)

  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
  // 监听基站数据变化，实时更新3D显示
  watch(() => store.stations, (newStations) => {
    newStations.forEach(station => {
      const entity = viewer.entities.getById(station.id)
      const poleEntity = viewer.entities.getById(`${station.id}_pole`)

      if (entity) {
        // 更新基站位置和标签
        entity.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(
                station.longitude,
                station.latitude,
                station.height
            )
        )

        if (entity.label) {
          entity.label.text = new Cesium.ConstantProperty(`${station.name}\n高度: ${station.height}m`)
        }
      }

      // 更新支撑杆
      if (poleEntity && poleEntity.polyline) {
        poleEntity.polyline.positions = new Cesium.ConstantProperty([
          Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 0),
          Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height)
        ])
      }
    })
  }, { deep: true })
  //监听监听楼体数据变化，实时更新3D显示
  watch(() => buildingStore.buildings, (newBuildings) => {
    console.log('楼体数据变化，更新地图显示')

    newBuildings.forEach(building => {
      const entity = viewer.entities.getById(building.id)
      if (entity && entity.box) {
        console.log('更新楼体:', building.name)

        // 更新楼体位置
        entity.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(building.longitude, building.latitude, building.height/2)
        )

        // 更新楼体尺寸
        entity.box.dimensions = new Cesium.ConstantProperty(
            new Cesium.Cartesian3(building.width, building.length, building.height)
        )

        // 更新楼体材质
        entity.box.material = new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString(building.color).withAlpha(building.opacity)
        );
        // 更新轮廓颜色
        entity.box.outlineColor = new Cesium.ConstantProperty(
            Cesium.Color.fromCssColorString(building.color)
        )

        // 更新标签
        if (entity.label) {
          entity.label.text = new Cesium.ConstantProperty(
              `${building.name}\n${building.width}×${building.length}×${building.height}m\n${building.floors}层`
          )
          entity.label.pixelOffset = new Cesium.ConstantProperty(
              new Cesium.Cartesian2(0, -building.height/2 - 30)
          )
        }

        // 更新旋转
        if (building.rotation !== 0) {
          const heading = Cesium.Math.toRadians(building.rotation)
          const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0)
          const orientation = Cesium.Transforms.headingPitchRollQuaternion(
              Cesium.Cartesian3.fromDegrees(building.longitude, building.latitude, building.height/2),
              hpr
          )
          entity.orientation = new Cesium.ConstantProperty(orientation)
        }
      } else {
        // 如果实体不存在，重新创建
        console.log('楼体实体不存在，重新创建:', building.name)
        addBuildingToMap(building)
      }
    })
  }, { deep: true })

  // 4. 修复：监听删除楼体事件
  window.addEventListener('removeBuildingFromMap', (event:any) => {
    const { buildingId, building } = event.detail
    console.log('删除楼体事件:', buildingId, building?.name)

    const entity = viewer.entities.getById(buildingId)
    if (entity) {
      viewer.entities.remove(entity)
      console.log('楼体已从地图删除:', buildingId)
    } else {
      console.warn('要删除的楼体不存在:', buildingId)
    }
  })
// 5. 修复：监听楼体更新事件
  window.addEventListener('updateBuildingOnMap', (event:any) => {
    const { buildingId, building } = event.detail
    console.log('更新楼体事件:', buildingId, building?.name)

    // 移除旧的实体
    const oldEntity = viewer.entities.getById(buildingId)
    if (oldEntity) {
      viewer.entities.remove(oldEntity)
    }

    // 添加新的实体
    addBuildingToMap(building)
  })
      // 监听删除基站事件
  window.addEventListener('removeStationFromMap', (event: any) => {
    const { stationId,station } = event.detail
    const entity = viewer.entities.getById(stationId)
    const poleEntity = viewer.entities.getById(`${stationId}_pole`)

    console.log(station)
    // 清除该基站所有天线的射线可视化
    if (station) {
      station.antennas.forEach(antenna => {
        geometricRayVisualization.clearAntenna(antenna.id)

        threeJSRayTracingManager.clearAntenna(antenna.id)  // 新增Three.js清除
      })
    }
    if (entity) viewer.entities.remove(entity)
    if (poleEntity) viewer.entities.remove(poleEntity)
  })

  // 监听飞行到基站事件
  window.addEventListener('flyToStation', (event: any) => {
    const { longitude, latitude, height } = event.detail
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 200),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0.0
      },
      duration: 2.0
    })
  })
  // 修复：监听飞行到楼体事件 - 增加调试信息
  window.addEventListener('flyToBuilding', (event:any) => {
        console.log('收到飞行到楼体事件:', event)
        console.log('Event detail:', event.detail)

        if (!event.detail) {
          console.error('飞行事件detail为空!')
          return
        }

        const { buildingId, building, longitude, latitude, height, orientation } = event.detail
        console.log('飞行到楼体事件详情:', {
          buildingId,
          buildingName: building?.name,
          longitude,
          latitude,
          height
        })

        if (longitude === undefined || latitude === undefined || height === undefined) {
          console.error('飞行坐标数据不完整:', { longitude, latitude, height })
          return
        }

        console.log(`开始飞行到楼体: ${building?.name || buildingId} (${longitude}, ${latitude}, ${height})`)

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 150),
          orientation: orientation || {
            heading: Cesium.Math.toRadians(45),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0.0
          },
          duration: 2.0
        })
      })

      //修复：监听添加楼体到地图事件（用于复制功能）
  window.addEventListener('addBuildingToMap', (event:any) => {
    const { building } = event.detail
    console.log('添加楼体到地图事件:', building?.name)
    addBuildingToMap(building)
  })

  // 监听清空所有基站事件
  window.addEventListener('clearAllStationsFromMap', () => {
    geometricRayVisualization.clearAll()

    threeJSRayTracingManager.clearAll()
    viewer.entities.removeAll()
  })
// 修复：监听清空所有楼体事件 - 增加调试信息
  window.addEventListener('clearAllBuildingsFromMap', (event) => {
    console.log('收到清空所有楼体事件:', event)

    // 移除所有楼体实体（通过box属性识别）
    const buildingEntities: Cesium.Entity[] = []
    viewer.entities.values.forEach(entity => {
      if (entity.box) { // 识别楼体实体（有box属性）
        buildingEntities.push(entity)
      }
    })

    console.log(`找到 ${buildingEntities.length} 个楼体实体待删除`)

    buildingEntities.forEach((entity, index) => {
      console.log(`删除楼体实体 ${index + 1}:`, entity.id)
      viewer.entities.remove(entity)
    })

    console.log(`✅ 已清空 ${buildingEntities.length} 个楼体`)
  })

// 修复：监听添加楼体到地图事件 - 增加调试信息
  window.addEventListener('addBuildingToMap', (event:any) => {
    console.log('收到添加楼体到地图事件:', event)
    console.log('Event detail:', event.detail)

    if (!event.detail) {
      console.error('添加楼体事件detail为空!')
      return
    }

    const { building } = event.detail
    if (!building) {
      console.error('添加楼体事件中building为空!')
      return
    }

    console.log('添加楼体到地图:', building.name, building.id)
    addBuildingToMap(building)
  })
  // 监听重新加载基站事件（用于数据导入）
  window.addEventListener('reloadStationsOnMap', (event: any) => {
    const { stations } = event.detail
    geometricRayVisualization.clearAll()

    threeJSRayTracingManager.clearAll()
    viewer.entities.removeAll()

    stations.forEach((station: any) => {
      // 重新添加基站实体
      viewer.entities.add({
        id: station.id,
        position: Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height),
        billboard: {
          image: '/station-icon.png',
          scale: 0.6,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.NONE
        },
        label: {
          text: `${station.name}\n高度: ${station.height}m`,
          font: '12px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -40),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE
        }
      })

      // 重新添加支撑杆
      viewer.entities.add({
        id: `${station.id}_pole`,
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 0),
            Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height)
          ],
          width: 3,
          material: Cesium.Color.GRAY.withAlpha(0.8),
          clampToGround: false
        }
      })
      // 重新渲染启用的天线射线
      station.antennas.forEach((antenna: any) => {
        if (antenna.visualization?.enabled) {
          geometricRayVisualization.renderAntenna(station, antenna)
        }
      })
    })
  })
  // ========== 修改：现有的天线可视化更新事件，支持多种模式
  window.addEventListener('updateAntennaVisualization', (event: any) => {
    const { stationId, antennaId, antenna } = event.detail
    const station = store.stations.find(s => s.id === stationId)

    if (station && antenna) {

      // 根据当前射线追踪类型更新相应的可视化
      switch (antenna.rayTracingType) {
        case 'geometric':
          if (antenna.visualization.enabled) {
            geometricRayVisualization.renderAntenna(station, antenna)
          } else {
            geometricRayVisualization.clearAntenna(antennaId)
          }
          break

        case 'threejs':
          if (antenna.threeJSRayTracing.enabled) {
            console.log('更新天线可视化', antennaId, antenna.rayTracingType, antenna.threeJSRayTracing.enabled)
            threeJSRayTracingManager.renderAntenna(station, antenna)
          } else {
            threeJSRayTracingManager.clearAntenna(antennaId)
          }
          break


      }
    }
  })
// 监听基站位置更新事件
  window.addEventListener('updateStationPosition', (event: any) => {
    const { stationId, longitude, latitude, height } = event.detail
    const entity = viewer.entities.getById(stationId)
    const poleEntity = viewer.entities.getById(`${stationId}_pole`)

    if (entity) {
      // 更新基站位置
      entity.position =new Cesium.ConstantPositionProperty (Cesium.Cartesian3.fromDegrees(longitude, latitude, height))
    }

    if (poleEntity && poleEntity.polyline) {
      // 更新支撑杆位置
      poleEntity.polyline.positions =new Cesium.ConstantProperty ([
        Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
        Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
      ])
    }
  })
  // 监听删除天线可视化事件
  window.addEventListener('removeAntennaVisualization', (event: any) => {
    const { antennaId } = event.detail
    geometricRayVisualization.clearAntenna(antennaId)
    threeJSRayTracingManager.clearAntenna(antennaId)
  })
}
)


</script>

<style scoped>
#cesiumContainer {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  position: relative;
}
</style>