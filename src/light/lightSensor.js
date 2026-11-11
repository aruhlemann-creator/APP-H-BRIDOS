// Sensor de luminosidade (lux). Disponível só no Android;
// o iOS não oferece esse sensor para apps.
import { Platform } from 'react-native';
import { LightSensor } from 'expo-sensors';

export async function isLightSensorAvailable() {
  if (Platform.OS !== 'android') return false;
  try {
    return await LightSensor.isAvailableAsync();
  } catch {
    return false;
  }
}

// Começa a ler o sensor. Retorna a função que para a leitura.
export function startLightSensor(onLux) {
  // O mais rápido possível (o original usava SENSOR_DELAY_FASTEST)
  LightSensor.setUpdateInterval(16);
  const subscription = LightSensor.addListener(({ illuminance }) => onLux(illuminance));
  return () => subscription.remove();
}
