<template>
  <div ref="cesiumContainer" id="cesiumContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as Cesium from 'cesium'
import { useBaseStationStore } from '../stores/baseStations'
import { nanoid } from 'nanoid'

const store = useBaseStationStore()
const cesiumContainer = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer

onMounted(() => {
  if (!cesiumContainer.value) return

  // 初始化Cesium场景
   viewer = new Cesium.Viewer(cesiumContainer.value, {

  })
  // 设置默认视角到重庆市
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(106.5, 29.5, 50000), // 重庆坐标，高度50km
    orientation: {
      heading: Cesium.Math.toRadians(0),     // 正北方向
      pitch: Cesium.Math.toRadians(-45),     // 俯视角度45度
      roll: 0.0
    }
  })
  // 处理地图点击事件 - 添加基站
  viewer.screenSpaceEventHandler.setInputAction((event) => {
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

  // 监听基站数据变化，实时更新3D显示
  watch(() => store.stations, (newStations) => {
    newStations.forEach(station => {
      const entity = viewer.entities.getById(station.id)
      const poleEntity = viewer.entities.getById(`${station.id}_pole`)

      if (entity) {
        // 更新基站位置和标签
        entity.position = Cesium.Cartesian3.fromDegrees(
            station.longitude,
            station.latitude,
            station.height
        )

        if (entity.label) {
          entity.label.text = `${station.name}\n高度: ${station.height}m`
        }
      }

      // 更新支撑杆
      if (poleEntity && poleEntity.polyline) {
        poleEntity.polyline.positions = [
          Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 0),
          Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height)
        ]
      }
    })
  }, { deep: true })

  // 监听删除基站事件
  window.addEventListener('removeStationFromMap', (event: any) => {
    const { stationId } = event.detail
    const entity = viewer.entities.getById(stationId)
    const poleEntity = viewer.entities.getById(`${stationId}_pole`)

    if (entity) viewer.entities.remove(entity)
    if (poleEntity) viewer.entities.remove(poleEntity)
  })

  // 监听飞行到基站事件
  window.addEventListener('flyToStation', (event: any) => {
    const { longitude, latitude, height } = event.detail
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 200),
      duration: 2.0
    })
  })

  // 监听清空所有基站事件
  window.addEventListener('clearAllStationsFromMap', () => {
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
    })
  })
// 监听基站位置更新事件
  window.addEventListener('updateStationPosition', (event: any) => {
    const { stationId, longitude, latitude, height } = event.detail
    const entity = viewer.entities.getById(stationId)
    const poleEntity = viewer.entities.getById(`${stationId}_pole`)

    if (entity) {
      // 更新基站位置
      entity.position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    }

    if (poleEntity && poleEntity.polyline) {
      // 更新支撑杆位置
      poleEntity.polyline.positions = [
        Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
        Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
      ]
    }
  })})
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