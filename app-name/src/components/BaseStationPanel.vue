<template>
  <div class="panel">
    <!-- 左侧收缩按钮 -->
    <div class="toggle-btn" @click="togglePanel" :class="{ expanded: isExpanded }">
      {{ isExpanded ? '◀' : '▶' }}
    </div>

    <!-- 左侧基站列表 -->
    <div class="list" v-show="isExpanded">
      <h3>基站列表 ({{ store.totalStations }})</h3>
      <ul>
        <li
            v-for="s in store.stations"
            :key="s.id"
            @click="selectAndShowDetails(s.id)"
            :class="{ active: s.id === store.selectedId }"
        >
          <span>{{ s.name }}</span>
          <small>高度: {{ s.height }}m ({{ s.antennas.length }}天线)</small>
        </li>
      </ul>
      <div class="stats">
        <p>总基站数：{{ store.totalStations }}</p>
        <p>总天线数：{{ store.totalAntennas }}</p>
      </div>
    </div>

    <!-- 右侧基站详情 -->
    <div class="details" v-if="selected && isExpanded && showDetails">
      <h3>基站信息</h3>

      <!-- 基站基本信息编辑 -->
      <div class="info-group">
        <label>
          名称：
          <input
              v-model="selected.name"
              @input="updateStation"
              placeholder="请输入基站名称"
          />
        </label>

        <label>
          高度：
          <div class="height-input-group">
            <input
                type="number"
                v-model.number="selected.height"
                @input="updateStation"
                min="0"
                max="500"
                step="1"
                placeholder="基站高度"
            />
            <span class="unit">米</span>
          </div>
        </label>

        <div class="coordinate-info">
          <p>经度：{{ selected.longitude.toFixed(6) }}°</p>
          <p>纬度：{{ selected.latitude.toFixed(6) }}°</p>
        </div>

        <!-- 高度快速设置按钮 -->
        <div class="height-presets">
          <span class="preset-label">快速设置：</span>
          <button @click="setHeight(15)" class="preset-btn">15m</button>
          <button @click="setHeight(30)" class="preset-btn">30m</button>
          <button @click="setHeight(50)" class="preset-btn">50m</button>
          <button @click="setHeight(80)" class="preset-btn">80m</button>
        </div>
      </div>

      <!-- 天线配置区域 -->
      <div class="antenna-section">
        <h4>天线配置 ({{ selected.antennas.length }})</h4>

        <div v-for="(antenna, index) in selected.antennas" :key="antenna.id" class="antenna-item">
          <div class="antenna-header">
            <h5>
              天线 {{ index + 1 }}
              <span class="antenna-height">
                (基站+{{ antenna.height }}m = {{ selected.height + antenna.height }}m)
              </span>
            </h5>
            <button @click="removeAntenna(antenna.id)" class="btn-remove">🗑️</button>
          </div>

          <!-- 天线参数配置 -->
          <div class="antenna-controls">
            <label>
              类型：
              <select v-model="antenna.type">
                <option>单天线</option>
                <option>多天线</option>
              </select>
            </label>

            <label>
              方向角：
              <input
                  type="number"
                  v-model.number="antenna.azimuth"
                  min="0"
                  max="360"
                  step="1"
                  title="0度为正北"
              />°
            </label>

            <label>
              俯仰角：
              <input
                  type="number"
                  v-model.number="antenna.elevation"
                  min="-90"
                  max="90"
                  step="1"
                  title="0度为水平"
              />°
            </label>

            <label>
              相对高度：
              <input
                  type="number"
                  v-model.number="antenna.height"
                  min="0"
                  max="100"
                  step="0.5"
                  title="相对于基站的高度"
              />m
            </label>

            <label>
              发射功率：
              <input
                  type="number"
                  v-model.number="antenna.power"
                  step="0.1"
              />dBm
            </label>

            <label>
              增益：
              <input
                  type="number"
                  v-model.number="antenna.gain"
                  step="0.1"
              />dBi
            </label>
          </div>
        </div>

        <button @click="addAntenna" class="btn-add">➕ 添加天线</button>
      </div>

      <!-- 基站操作按钮 -->
      <div class="station-actions">
        <button @click="deleteStation" class="btn-delete">🗑️ 删除基站</button>
        <button @click="flyToStation" class="btn-fly">📍 定位到基站</button>
      </div>
    </div>

    <!-- 未选中时的提示 -->
<!--    <div v-else class="no-selection">-->
<!--      <h4>基站管理系统</h4>-->
<!--      <p>🎯 在地图上点击添加基站</p>-->
<!--      <p>📋 从左侧列表选择基站进行编辑</p>-->
<!--      <p>📡 配置天线参数和覆盖范围</p>-->
<!--    </div>-->
  </div>
</template>

<script setup lang="ts">
import { computed ,ref} from 'vue'
import { useBaseStationStore } from '../stores/baseStations'
import { nanoid } from 'nanoid'
import type { Antenna } from '../types'

const store = useBaseStationStore()
const selected = computed(() => store.selectedStation)
// 添加新的响应式变量
const isExpanded = ref(false)  // 面板是否展开
const showDetails = ref(false) // 是否显示详情

// 新增：切换面板显示/隐藏
function togglePanel() {
  isExpanded.value = !isExpanded.value
  if (!isExpanded.value) {
    showDetails.value = false
  }
}

// 修改：选择基站并显示详情
function selectAndShowDetails(id: string) {
  store.selectStation(id)
  showDetails.value = true
}
// 添加新天线（默认参数）
function addAntenna() {
  if (!selected.value) return

  const newAntenna: Antenna = {
    id: nanoid(),
    type: '单天线',
    azimuth: 0,
    elevation: 0,
    height: 5,
    power: 20,
    gain: 15
  }

  store.addAntennaToStation(selected.value.id, newAntenna)
}


function removeAntenna(antennaId: string) {
  if (!selected.value) return

  if (confirm('确定要删除这个天线吗？')) {
    store.removeAntennaFromStation(selected.value.id, antennaId)
  }
}

// 更新基站信息到store
function updateStation() {
  if (!selected.value) return

  store.updateStation(selected.value.id, {
    name: selected.value.name,
    height: selected.value.height
  })
}

function setHeight(height: number) {
  if (!selected.value) return

  selected.value.height = height
  updateStation()
}

function deleteStation() {
  if (!selected.value) return

  if (confirm(`确定要删除基站 "${selected.value.name}" 吗？`)) {
    store.removeStation(selected.value.id)
  }
}

// 通过事件通知地图组件飞行到基站
function flyToStation() {
  if (!selected.value) return

  window.dispatchEvent(new CustomEvent('flyToStation', {
    detail: {
      longitude: selected.value.longitude,
      latitude: selected.value.latitude,
      height: selected.value.height
    }
  }))
}
</script>

<style scoped>
/* 新增：切换按钮样式 */
.toggle-btn {

  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 60px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ccc;
  border-left: none;
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  color: red;
  transition: all 0.3s;
  z-index: 1001;
}

.toggle-btn:hover {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.toggle-btn.expanded {
  left: 240px; /* 列表宽度 */
}

/* 修改：面板样式 */
.panel {
  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 1000;
  transition: all 0.3s;
}

.list {
  width: 240px;
  border-right: 1px solid #ddd;
  padding: 15px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  height: 100vh;
}

.details {
  width: 380px;
  padding: 15px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  height: 100vh;
  border-right: 1px solid #ccc;
}

.no-selection {
  width: 380px;
  padding: 50px 20px;
  text-align: center;
  color: #666;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  height: 100vh;
}
.panel {
  display: flex;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  border-right: 1px solid #ccc;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
}

.list {
  width: 240px;
  border-right: 1px solid #ddd;
  padding: 15px;
  overflow-y: auto;
  background: skyblue;
}

.list h3 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
}

.list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list li {
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s;
  background: white;
}

.list li:hover {
  background: #f5f5f5;
  transform: translateX(2px);
}

.list li.active {
  background: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 2px 4px rgba(33, 150, 243, 0.2);
}

.list li span {
  display: block;
  font-weight: 500;
  color: #333;
}

.list small {
  display: block;
  color: #666;
  font-size: 11px;
  margin-top: 2px;
}

.stats {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  font-size: 12px;
  color: #666;
}

.details {
  width: 380px;
  padding: 15px;
  overflow-y: auto;
}

.no-selection {
  width: 380px;
  padding: 50px 20px;
  text-align: center;
  color: #666;
}

.no-selection h4 {
  color: #333;
  margin-bottom: 20px;
}

.no-selection p {
  margin: 8px 0;
  font-size: 14px;
}

.info-group {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.info-group label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.info-group input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 4px;
  font-size: 13px;
}

.height-input-group {
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.height-input-group input {
  flex: 1;
  margin-top: 0;
  margin-right: 8px;
}

.height-input-group .unit {
  color: #666;
  font-size: 12px;
}

.coordinate-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.coordinate-info p {
  margin: 0;
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 6px 8px;
  border-radius: 3px;
}

.height-presets {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 12px;
  color: #666;
  margin-right: 4px;
}

.preset-btn {
  padding: 4px 8px;
  font-size: 11px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: #e0e0e0;
}

.antenna-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 15px;
}

.antenna-item {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 15px;
  background: #fafafa;
}

.antenna-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.antenna-header h5 {
  margin: 0;
  color: #555;
  font-size: 13px;
}

.antenna-height {
  font-weight: normal;
  color: #888;
  font-size: 11px;
}

.antenna-controls {
  display: grid;
  gap: 10px;
}

.antenna-controls label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin: 0;
}

.antenna-controls input,
.antenna-controls select {
  width: 90px;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
}

.btn-add {
  width: 100%;
  padding: 10px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-add:hover {
  background: #45a049;
}

.btn-remove {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.btn-remove:hover {
  background: #da190b;
}

.station-actions {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
}

.btn-delete {
  flex: 1;
  padding: 8px 12px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete:hover {
  background: #da190b;
}

.btn-fly {
  flex: 1;
  padding: 8px 12px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-fly:hover {
  background: #1976d2;
}
</style>