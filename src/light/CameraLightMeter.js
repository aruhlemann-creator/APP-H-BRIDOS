// Mede a luz pela câmera: brilho médio de cada quadro (0–255).
//
// O expo-camera não dá acesso aos pixels dos quadros, então a medição roda
// numa WebView (incluída no Expo Go) com getUserMedia + canvas. A WebView
// também mostra a prévia da câmera para mirar o transmissor.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const html = (facing) => `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  video{width:100%;height:100%;object-fit:cover}
</style>
</head><body>
<video id="v" playsinline webkit-playsinline muted autoplay></video>
<script>
(function () {
  var send = function (msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  var video = document.getElementById('v');
  var canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 24;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });

  function brightness() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var sum = 0;
    for (var i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return sum / (d.length / 4);
  }

  // Trava exposição e balanço de branco onde o aparelho deixar; senão o
  // ajuste automático "compensa" o flash e reduz o contraste.
  function lockExposure(track) {
    if (!track || !track.getCapabilities) return Promise.resolve(false);
    var caps = track.getCapabilities();
    var adv = {};
    if (caps.exposureMode && caps.exposureMode.indexOf('manual') >= 0) adv.exposureMode = 'manual';
    if (caps.whiteBalanceMode && caps.whiteBalanceMode.indexOf('manual') >= 0) adv.whiteBalanceMode = 'manual';
    if (!Object.keys(adv).length) return Promise.resolve(false);
    return track.applyConstraints({ advanced: [adv] }).then(function () { return true; }, function () { return false; });
  }

  function loop() {
    if (video.readyState >= 2) send({ type: 'lux', value: brightness() });
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(loop);
    else setTimeout(loop, 33);
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    send({ type: 'error', message: 'Câmera indisponível neste aparelho.' });
    return;
  }

  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: '${facing}' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }
  }).then(function (stream) {
    video.srcObject = stream;
    return video.play().then(function () { return lockExposure(stream.getVideoTracks()[0]); });
  }).then(function (locked) {
    send({ type: 'ready', exposureLocked: locked });
    loop();
  }).catch(function (e) {
    send({ type: 'error', message: 'Não foi possível abrir a câmera (' + (e && e.name || e) + ').' });
  });
})();
</script>
</body></html>`;

// facing: 'user' (frontal) ou 'environment' (traseira)
// onReady({ exposureLocked }), onLux(valor), onError(mensagem)
export default function CameraLightMeter({ facing, onReady, onLux, onError }) {
  // Mesma página enquanto a câmera não mudar, para a WebView não recarregar
  // a cada atualização da tela
  const source = useMemo(() => ({ html: html(facing), baseUrl: 'https://localhost' }), [facing]);

  const handleMessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'lux') onLux(msg.value);
    else if (msg.type === 'ready') onReady(msg);
    else if (msg.type === 'error') onError(msg.message);
  };

  return (
    <View style={styles.box}>
      <WebView
        // key força recriar a câmera ao trocar frontal/traseira
        key={facing}
        source={source}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 180, backgroundColor: '#000', marginBottom: 16, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#000' },
});
