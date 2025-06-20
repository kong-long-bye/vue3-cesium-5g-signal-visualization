import type { PropagationModel, Antenna, BaseStation, SignalStrengthResult } from '../types'

// 预定义的传播模型
export const PROPAGATION_MODELS: PropagationModel[] = [
    {
        type: 'free-space',
        name: 'Free-Space 自由空间模型',
        description: '理想自由空间环境下的信号传播，适用于卫星通信和视距传播场景。公式：PL = 20×log10(d) + 20×log10(f) + 32.45',
        parameters: {}
    },
    {
        type: 'cost-231-hata',
        name: 'COST-231-Hata 城市模型',
        description: '适用于城市和郊区环境的经典传播模型，考虑了建筑物密度、基站高度等因素。频率范围：1500-2000MHz',
        parameters: {
            cityType: 1, // 1=大城市, 0=中小城市
            terrainType: 1 // 1=城市, 0=郊区
        }
    },
    {
        type: 'itu-indoor',
        name: 'ITU 室内模型',
        description: '国际电信联盟推荐的室内传播模型，考虑了墙体损耗、楼层衰减等室内传播特性',
        parameters: {
            floors: 1,
            wallLoss: 12
        }
    },
    {
        type: 'ray-tracing',
        name: 'Ray-Tracing 射线追踪',
        description: '基于几何光学理论的精确传播模型，考虑反射、绕射、散射等多径传播效应，计算精度高但复杂度大',
        parameters: {
            maxReflections: 3,
            minSignalLevel: -120
        }
    }
]

/**
 * 获取传播模型信息
 */
export function getPropagationModel(type: string): PropagationModel | null {
    return PROPAGATION_MODELS.find(model => model.type === type) || null
}

/**
 * 计算两点之间的3D距离
 * @param lat1 起点纬度
 * @param lon1 起点经度
 * @param height1 起点高度
 * @param lat2 终点纬度
 * @param lon2 终点经度
 * @param height2 终点高度
 * @returns 距离（米）
 */
function calculate3DDistance(
    lat1: number, lon1: number, height1: number,
    lat2: number, lon2: number, height2: number
): number {
    const R = 6371000 // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const horizontalDistance = R * c

    const heightDiff = height2 - height1

    return Math.sqrt(horizontalDistance * horizontalDistance + heightDiff * heightDiff)
}

/**
 * Free-Space 自由空间传播模型
 * PL(dB) = 20*log10(d) + 20*log10(f) + 32.45
 * @param distance 距离（米）
 * @param frequency 频率（MHz）
 * @returns 路径损耗（dB）
 */
function freeSpacePathLoss(distance: number, frequency: number): number {
    if (distance <= 0 || frequency <= 0) return 0

    const distanceKm = distance / 1000 // 转换为公里
    return 20 * Math.log10(distanceKm) + 20 * Math.log10(frequency) + 32.45
}

/**
 * COST-231-Hata 模型
 * @param distance 距离（米）
 * @param frequency 频率（MHz）
 * @param hb 基站高度（米）
 * @param hm 移动台高度（米）
 * @param cityType 城市类型 1=大城市 0=中小城市
 * @returns 路径损耗（dB）
 */
function cost231HataPathLoss(
    distance: number,
    frequency: number,
    hb: number = 30,
    hm: number = 1.5,
    cityType: number = 1
): number {
    if (distance < 1 || frequency < 1500 || frequency > 2000) {
        return freeSpacePathLoss(distance, frequency) // 超出范围时使用自由空间模型
    }

    const distanceKm = distance / 1000

    // 移动台天线高度修正因子
    const ahm = cityType === 1 ?
        3.2 * Math.pow(Math.log10(11.75 * hm), 2) - 4.97 : // 大城市
        (1.1 * Math.log10(frequency) - 0.7) * hm - (1.56 * Math.log10(frequency) - 0.8) // 中小城市

    // 基本传播损耗
    const pathLoss = 46.3 + 33.9 * Math.log10(frequency) - 13.82 * Math.log10(hb) - ahm +
        (44.9 - 6.55 * Math.log10(hb)) * Math.log10(distanceKm) + 3 // 城市修正因子

    return Math.max(pathLoss, freeSpacePathLoss(distance, frequency))
}

/**
 * 计算信号强度
 * @param station 基站信息
 * @param antenna 天线信息
 * @param targetLat 目标点纬度
 * @param targetLon 目标点经度
 * @param targetHeight 目标点高度（米）
 * @returns 信号强度计算结果
 */
export function calculateSignalStrength(
    station: BaseStation,
    antenna: Antenna,
    targetLat: number,
    targetLon: number,
    targetHeight: number = 1.5
): SignalStrengthResult {
    // 计算天线实际位置
    const antennaHeight = station.height + antenna.height

    // 计算3D距离
    const distance = calculate3DDistance(
        station.latitude, station.longitude, antennaHeight,
        targetLat, targetLon, targetHeight
    )

    // 根据传播模型类型计算路径损耗
    let pathLoss: number

    switch (antenna.propagationModel.type) {
        case 'free-space':
            pathLoss = freeSpacePathLoss(distance, antenna.frequency)
            break

        case 'cost-231-hata':
            pathLoss = cost231HataPathLoss(
                distance,
                antenna.frequency,
                antennaHeight,
                targetHeight,
                antenna.propagationModel.parameters?.cityType || 1
            )
            break

        case 'itu-indoor':
            // ITU室内模型简化实现
            pathLoss = freeSpacePathLoss(distance, antenna.frequency) +
                (antenna.propagationModel.parameters?.wallLoss || 12) +
                (antenna.propagationModel.parameters?.floors || 1) * 15
            break

        case 'ray-tracing':
            // Ray-tracing模型简化为自由空间+多径衰减
            pathLoss = freeSpacePathLoss(distance, antenna.frequency) + Math.random() * 10
            break

        default:
            pathLoss = freeSpacePathLoss(distance, antenna.frequency)
    }

    // 计算接收信号强度：RSSI = 发射功率 + 发射增益 - 路径损耗
    const rssi = antenna.power + antenna.gain - pathLoss

    return {
        rssi: Math.round(rssi * 100) / 100,
        distance: Math.round(distance * 100) / 100,
        pathLoss: Math.round(pathLoss * 100) / 100,
        antennaId: antenna.id,
        stationId: station.id,
        model: antenna.propagationModel.name
    }
}

/**
 * 计算多个基站的最强信号
 * @param stations 基站数组
 * @param targetLat 目标纬度
 * @param targetLon 目标经度
 * @param targetHeight 目标高度
 * @returns 最强信号结果数组（按信号强度降序）
 */
export function calculateBestSignal(
    stations: BaseStation[],
    targetLat: number,
    targetLon: number,
    targetHeight: number = 1.5
): SignalStrengthResult[] {
    const results: SignalStrengthResult[] = []

    stations.forEach(station => {
        station.antennas.forEach(antenna => {
            const result = calculateSignalStrength(station, antenna, targetLat, targetLon, targetHeight)
            results.push(result)
        })
    })

    // 按信号强度降序排序
    return results.sort((a, b) => b.rssi - a.rssi)
}