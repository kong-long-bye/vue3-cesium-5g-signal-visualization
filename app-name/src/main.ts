import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'

const app = createApp(App) // 创建 app 实例
const pinia = createPinia()

app.use(pinia) // 使用 pinia
app.mount('#app') // 挂载到 DOM

// 在 main.ts 中添加全局调试函数
import { useBuildingStore } from './stores/buildings'
import {useBaseStationStore} from "./stores/baseStations.ts";

// 创建全局调试函数
window.debugApp = {
    // 检查buildingStore
    checkBuildingStore() {
        const buildingStore = useBuildingStore()
        console.log('🏗️ BuildingStore 状态:')
        console.log('  建筑物数量:', buildingStore.buildings.length)
        console.log('  建筑物列表:', buildingStore.buildings)
        console.log('  选中建筑物ID:', buildingStore.selectedBuildingId)
        console.log('  创建模式状态:', buildingStore.isCreatingBuilding)
        console.log('  完整Store对象:', buildingStore)
        return buildingStore
    },

    // 检查所有Store
    checkAllStores() {
        const buildingStore = useBuildingStore()
        const baseStationStore = useBaseStationStore() // 如果有的话

        console.log('📊 所有Store状态:')
        console.log('BuildingStore:', buildingStore)
        console.log('BaseStationStore:', baseStationStore)
    }
}

// 类型声明
declare global {
    interface Window {
        debugApp: {
            checkBuildingStore(): any
            checkAllStores(): void
        }
    }
}