// 天线接口定义
export interface Antenna {
    id: string
    type: '单天线' | '多天线'  // 天线类型
    azimuth: number          // 方向角（度）
    elevation: number        // 俯仰角（度）
    height: number          // 天线高度（米）
    power: number           // 发射功率（dBm）
    gain: number            // 天线增益（dBi）
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