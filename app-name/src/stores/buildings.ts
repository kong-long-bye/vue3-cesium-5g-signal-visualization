import { defineStore } from 'pinia'
import type { Building, BuildingMaterialType } from '../types'
import { getBuildingMaterial } from '../utils/buildingMaterials'

export const useBuildingStore = defineStore('buildings', {
    state: () => ({
        buildings: [] as Building[],           // 所有楼体数据
        selectedBuildingId: null as string | null,  // 当前选中的楼体ID
        isCreatingBuilding: false              // 是否处于创建楼体模式
    }),

    actions: {
        // 切换创建楼体模式
        toggleBuildingCreationMode() {
            this.isCreatingBuilding = !this.isCreatingBuilding
        },

        // 设置创建楼体模式
        setBuildingCreationMode(mode: boolean) {
            this.isCreatingBuilding = mode
        },

        // 添加新楼体
        addBuilding(building: Building) {
            this.buildings.push(building)
        },

        // 选中指定楼体
        selectBuilding(id: string) {
            this.selectedBuildingId = id
        },

        // 取消选择楼体
        unselectBuilding() {
            this.selectedBuildingId = null
        },

        // 更新楼体信息
        updateBuilding(id: string, data: Partial<Building>) {
            const index = this.buildings.findIndex(b => b.id === id)
            if (index !== -1) {
                this.buildings[index] = { ...this.buildings[index], ...data }

                // 触发地图更新事件
                window.dispatchEvent(new CustomEvent('updateBuildingOnMap', {
                    detail: {
                        buildingId: id,
                        building: this.buildings[index]
                    }
                }))
            }
        },

        // 删除楼体
        removeBuilding(id: string) {
            const index = this.buildings.findIndex(b => b.id === id)
            if (index !== -1) {
                const buildingToRemove = this.buildings[index]
                this.buildings.splice(index, 1)

                // 如果删除的是当前选中的楼体，清除选中状态
                if (this.selectedBuildingId === id) {
                    this.selectedBuildingId = null
                }

                // 触发自定义事件，通知地图更新
                window.dispatchEvent(new CustomEvent('removeBuildingFromMap', {
                    detail: { buildingId: id, building: buildingToRemove }
                }))
            }
        },

        // 清空所有楼体
        clearAllBuildings() {
            this.buildings = []
            this.selectedBuildingId = null
            this.isCreatingBuilding = false
            window.dispatchEvent(new CustomEvent('clearAllBuildingsFromMap'))
        },

        // 更新楼体材料（会自动更新相关损耗参数）
        updateBuildingMaterial(id: string, materialType: BuildingMaterialType) {
            const building = this.buildings.find(b => b.id === id)
            const material = getBuildingMaterial(materialType)

            if (building && material) {
                this.updateBuilding(id, {
                    materialType: materialType,
                    wallLoss: material.wallLoss,
                    roofLoss: material.roofLoss,
                    floorLoss: material.floorLoss,
                    color: material.color
                })
            }
        }
    },

    getters: {
        // 获取当前选中的楼体
        selectedBuilding(state): Building | null {
            return state.buildings.find(b => b.id === state.selectedBuildingId) || null
        },

        // 获取楼体总数
        totalBuildings(state): number {
            return state.buildings.length
        },

        // 获取楼体总体积（立方米）
        totalBuildingVolume(state): number {
            return state.buildings.reduce((total, building) => {
                return total + (building.width * building.length * building.height)
            }, 0)
        },

        // 按材料类型分组的楼体统计
        buildingsByMaterial(state): Record<BuildingMaterialType, number> {
            const stats: Record<string, number> = {}

            state.buildings.forEach(building => {
                const material = building.materialType
                stats[material] = (stats[material] || 0) + 1
            })

            return stats as Record<BuildingMaterialType, number>
        },

        // 平均墙体损耗
        averageWallLoss(state): number {
            if (state.buildings.length === 0) return 0

            const totalLoss = state.buildings.reduce((sum, building) => sum + building.wallLoss, 0)
            return Math.round((totalLoss / state.buildings.length) * 100) / 100
        }
    }
})