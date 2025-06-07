
// 传播模型类型
export type PropagationModelType = 'free-space' | 'cost-231-hata' | 'itu-indoor' | 'ray-tracing'

// 传播模型配置接口
export interface PropagationModel {
    type: PropagationModelType
    name: string
    description: string
    parameters?: Record<string, number>
}


// 天线接口定义
export interface Antenna {
    id: string
    type: '单天线' | '多天线'  // 天线类型
    azimuth: number          // 方向角（度）
    elevation: number        // 俯仰角（度）
    height: number          // 天线高度（米）
    power: number           // 发射功率（dBm）
    gain: number            // 天线增益（dBi）
    frequency: number       // 工作频率（MHz）- 新增
    propagationModel: PropagationModel  // 传播模型配置 - 新增
}

// 基站接口定义
export interface BaseStation {
    id: string              // 唯一标识符
    name: string           // 基站名称
    longitude: number      // 经度
    latitude: number       // 纬度
    height: number         // 基站高度（米，海拔高度）
    antennas: Antenna[]    // 关联的天线数组
}
// 信号强度计算结果
export interface SignalStrengthResult {
    rssi: number           // 接收信号强度 (dBm)
    distance: number       // 距离 (米)
    pathLoss: number       // 路径损耗 (dB)
    antennaId: string      // 天线ID
    stationId: string      // 基站ID
    model: string          // 使用的传播模型
}