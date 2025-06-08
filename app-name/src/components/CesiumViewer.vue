<template>
  <div ref="cesiumContainer" id="cesiumContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as Cesium from 'cesium'
import { useBaseStationStore } from '../stores/baseStations'
import { nanoid } from 'nanoid'
import{type SignalStrengthResult} from '../types.ts'
import { calculateBestSignal,   } from '../utils/propagationModels'
import { AntennaRayVisualization } from '../utils/antennaVisualization'
const store = useBaseStationStore()
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
    infoText += `\n📊 其他信号源 (${results.length - 1}个):\n`
    results.slice(1, 4).forEach((result, index) => {
      const station = store.stations.find(s => s.id === result.stationId)
      infoText += `${index + 2}. ${station?.name}: ${result.rssi.toFixed(1)} dBm\n`
    })
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


onMounted(() => {
  if (!cesiumContainer.value) return

  // 初始化Cesium场景
   viewer = new Cesium.Viewer(cesiumContainer.value, {

  })


      const rayVisualization = new AntennaRayVisualization(viewer)


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
    // 检查是否处于创建模式
    if (!store.isCreatingMode) return
    const cartesian = viewer.scene.pickPosition(event.position)
    if (!cartesian) return

    // 转换为经纬度坐标
    const carto = Cesium.Cartographic.fromCartesian(cartesian)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)

    const id = nanoid()
    const defaultHeight = 30 // 默认基站高度30米

    // 在3D地图中添加基站图标和标签
    viewer.entities.add({
      id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, defaultHeight),
      billboard: {
        image: '/station-icon.png',
        scale: 0.6,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.NONE
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
    const signalResults = calculateBestSignal(store.stations, lat, lon, height)

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

  // 监听删除基站事件
  window.addEventListener('removeStationFromMap', (event: any) => {
    const { stationId,station } = event.detail
    const entity = viewer.entities.getById(stationId)
    const poleEntity = viewer.entities.getById(`${stationId}_pole`)

    console.log(station)
    // 清除该基站所有天线的射线可视化
    if (station) {
      station.antennas.forEach(antenna => {
        rayVisualization.clearAntenna(antenna.id)
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

  // 监听清空所有基站事件
  window.addEventListener('clearAllStationsFromMap', () => {
    rayVisualization.clearAll()
    viewer.entities.removeAll()
  })

  // 监听重新加载基站事件（用于数据导入）
  window.addEventListener('reloadStationsOnMap', (event: any) => {
    const { stations } = event.detail
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
          rayVisualization.renderAntenna(station, antenna)
        }
      })
    })
  })
  window.addEventListener('updateAntennaVisualization', (event: any) => {
    const { stationId, antennaId, antenna } = event.detail
    const station = store.stations.find(s => s.id === stationId)

    if (station && antenna) {
      if (antenna.visualization.enabled) {
        // 渲染天线射线
        rayVisualization.renderAntenna(station, antenna)
      } else {
        // 清除天线射线

        rayVisualization.clearAntenna(antennaId)
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
    rayVisualization.clearAntenna(antennaId)
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