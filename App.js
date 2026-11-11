import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useCameraPermissions } from 'expo-camera';

import { createReceiver } from './src/vlc/receiver';
import { TEXTO_REFERENCIA } from './src/vlc/referencia';
import { isLightSensorAvailable, startLightSensor } from './src/light/lightSensor';
import CameraLightMeter from './src/light/CameraLightMeter';

const SOURCES = {
  sensor: { label: 'Sensor de luz' },
  'camera-front': { label: 'Câmera frontal', facing: 'user' },
  'camera-back': { label: 'Câmera traseira', facing: 'environment' },
};

const f2 = (v) => (typeof v === 'number' ? v.toFixed(2) : '–');

export default function App() {
  return (
    <SafeAreaProvider>
      <Receptor />
    </SafeAreaProvider>
  );
}

function Receptor() {
  // Equivalente ao keepScreenOn do layout original
  useKeepAwake();

  const [bitRateText, setBitRateText] = useState('');
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [source, setSource] = useState(Platform.OS === 'android' ? 'sensor' : 'camera-front');
  const [luxInfo, setLuxInfo] = useState(null);
  const [bits, setBits] = useState('');
  const [message, setMessage] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();

  const stopSensorRef = useRef(null);
  const pendingRateRef = useRef(1);
  const lastLuxUpdateRef = useRef(0);

  // Cria o receptor uma vez só
  const receiverRef = useRef(null);
  if (!receiverRef.current) {
    receiverRef.current = createReceiver({
      referenceText: TEXTO_REFERENCIA,
      // Atualiza a caixa de lux no máximo 10x por segundo
      onLuxInfo: (info) => {
        const t = Date.now();
        if (info.calibrating || t - lastLuxUpdateRef.current > 100) {
          lastLuxUpdateRef.current = t;
          setLuxInfo(info);
        }
      },
      onBits: setBits,
      onMessage: setMessage,
      onStop: () => stopSources(),
    });
  }
  const receiver = receiverRef.current;

  useEffect(() => {
    isLightSensorAvailable().then((ok) => {
      setSensorAvailable(ok);
      if (!ok) setSource((s) => (s === 'sensor' ? 'camera-front' : s));
    });
    return () => stopReception();
  }, []);

  function stopSources() {
    if (stopSensorRef.current) {
      stopSensorRef.current();
      stopSensorRef.current = null;
    }
    setCameraOn(false);
  }

  function stopReception() {
    receiver.stop();
    stopSources();
  }

  async function startReception() {
    Keyboard.dismiss();
    stopReception();

    const parsed = parseInt(bitRateText, 10);
    const bitRate = Number.isNaN(parsed) ? 1 : Math.min(5, Math.max(1, parsed));
    setLuxInfo(null);

    if (source === 'sensor') {
      if (!sensorAvailable) {
        setMessage('Erro: sensor de luminosidade indisponível.');
        return;
      }
      receiver.start(bitRate);
      stopSensorRef.current = startLightSensor((lux) => receiver.pushLux(lux));
      return;
    }

    // Câmera: pede permissão, abre a câmera e só então começa a calibrar
    const permission = await requestCameraPermission();
    if (!permission.granted) {
      setMessage('Erro: sem permissão para usar a câmera.\nLibere a câmera nos Ajustes do aparelho.');
      return;
    }
    pendingRateRef.current = bitRate;
    setBits('');
    setMessage('Abrindo câmera...');
    setCameraOn(true);
  }

  const isCamera = source !== 'sensor';
  const unit = isCamera ? 'Brilho' : 'Lux';
  const luxText = !luxInfo
    ? ''
    : luxInfo.calibrating
      ? `${unit}: ${f2(luxInfo.lux)}\nCalibrando...`
      : `${unit}: ${f2(luxInfo.lux)}\nBase: ${f2(luxInfo.base)}\nPico: ${f2(luxInfo.peak)}\nLimiar: ${f2(luxInfo.threshold)}`;

  const sourceKeys = Object.keys(SOURCES).filter((k) => k !== 'sensor' || sensorAvailable);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Receptor VLC</Text>
        <Text style={styles.subtitle}>Detecção de Comunicação Óptica (OOK)</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Taxa de bits (bits/s)</Text>
          <TextInput
            style={styles.input}
            value={bitRateText}
            onChangeText={setBitRateText}
            placeholder="Ex: 5"
            keyboardType="number-pad"
            maxLength={1}
          />

          <Text style={[styles.label, styles.spaced]}>Fonte de luz</Text>
          <View style={styles.segment}>
            {sourceKeys.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  stopReception();
                  setSource(key);
                }}
                style={[styles.segmentItem, source === key && styles.segmentItemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: source === key }}
              >
                <Text style={[styles.segmentText, source === key && styles.segmentTextActive]}>
                  {SOURCES[key].label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {cameraOn && isCamera && (
          <CameraLightMeter
            facing={SOURCES[source].facing}
            onReady={() => receiver.start(pendingRateRef.current)}
            onLux={(v) => receiver.pushLux(v)}
            onError={(msg) => {
              stopReception();
              setMessage(`Erro: ${msg}`);
            }}
          />
        )}

        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.start]} onPress={startReception}>
            <Text style={styles.buttonText}>INICIAR</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.stop]} onPress={stopReception}>
            <Text style={styles.buttonText}>PARAR</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>
          {isCamera ? 'Luz na Câmera (brilho 0–255)' : 'Sensor de Luminosidade (Lux)'}
        </Text>
        <Text style={[styles.box, styles.luxBox]}>{luxText}</Text>

        <Text style={styles.section}>Bits Recebidos</Text>
        <Text style={[styles.box, styles.bitsBox]}>{bits}</Text>

        <Text style={styles.section}>Mensagem Decodificada</Text>
        <Text style={[styles.box, styles.messageBox]}>{message}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const C = {
  bg: '#F5F7FA',
  navy: '#0A2A66',
  text: '#000000',
  muted: '#444444',
  box: '#ECEFF1',
  card: '#FFFFFF',
  green: '#2E7D32',
  red: '#C62828',
  border: '#B0BEC5',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: C.navy, textAlign: 'center' },
  subtitle: { fontSize: 16, color: C.muted, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: C.card,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  label: { fontSize: 14, fontWeight: 'bold', color: C.text },
  spaced: { marginTop: 16 },
  input: {
    marginTop: 8,
    paddingVertical: 8,
    fontSize: 16,
    color: C.text,
    borderBottomWidth: 2,
    borderBottomColor: C.navy,
  },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  segmentItemActive: { backgroundColor: C.navy, borderColor: C.navy },
  segmentText: { fontSize: 14, color: C.text },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  button: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  start: { backgroundColor: C.green },
  stop: { backgroundColor: C.red },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  section: { fontSize: 14, fontWeight: 'bold', color: C.text, marginTop: 16, marginBottom: 6 },
  box: { backgroundColor: C.box, padding: 10, color: C.text },
  luxBox: { minHeight: 60, fontSize: 16 },
  bitsBox: {
    minHeight: 120,
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  messageBox: { minHeight: 100, fontSize: 18 },
});
