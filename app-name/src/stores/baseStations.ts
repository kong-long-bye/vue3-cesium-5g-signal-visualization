import { defineStore } from 'pinia'
import type { BaseStation, Antenna } from '../types.ts'

export const useBaseStationStore = defineStore('baseStations', {
    state: () => ({
        stations: [] as BaseStation[],     // 所有基站数据
        selectedId: null as string | null  // 当前选中的基站ID
    }),

    actions: {
        // 添加新基站
        addStation(station: BaseStation) {
            this.stations.push(station)
        },

        // 选中指定基站
        selectStation(id: string) {
            this.selectedId = id
        },

        // 更新基站信息
        updateStation(id: string, data: Partial<BaseStation>) {
            const index = this.stations.findIndex(s => s.id === id)
            if (index !== -1) {
                this.stations[index] = { ...this.stations[index], ...data }
            }
        },

        // 删除基站
        removeStation(id: string) {
            const index = this.stations.findIndex(s => s.id === id)
            if (index !== -1) {
                this.stations.splice(index, 1)
                // 如果删除的是当前选中的基站，清除选中状态
                if (this.selectedId === id) {
                    this.selectedId = null
                }
            }
        },

        // 为基站添加天线
        addAntennaToStation(stationId: string, antenna: Antenna) {
            const station = this.stations.find(s => s.id === stationId)
            if (station) {
                station.antennas.push(antenna)
            }
        },

        // 从基站删除天线
        removeAntennaFromStation(stationId: string, antennaId: string) {
            const station = this.stations.find(s => s.id === stationId)
            if (station) {
                const index = station.antennas.findIndex(a => a.id === antennaId)
                if (index !== -1) {
                    station.antennas.splice(index, 1)
                }
            }
        }
    },

    getters: {
        // 获取当前选中的基站
        selectedStation(state): BaseStation | null {
            return state.stations.find(s => s.id === state.selectedId) || null
        },

        // 获取基站总数
        totalStations(state): number {
            return state.stations.length
        },

        // 获取总天线数
        totalAntennas(state): number {
            return state.stations.reduce((total, station) => total + station.antennas.length, 0)
        }
    }
})