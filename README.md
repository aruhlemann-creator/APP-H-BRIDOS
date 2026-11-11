# Receptor VLC (OOK)

Receptor de comunicação por luz visível (On-Off Keying), feito com
**Expo (React Native)**. Roda no **iPhone** e no **Android** com o mesmo código.

O app calibra o nível de luz ambiente, detecta o flash do transmissor,
sincroniza pelo preâmbulo `10101010`, decodifica a mensagem em ASCII e calcula
a BER comparando com o texto de referência.

| Plataforma | Fonte de luz |
|---|---|
| Android | sensor de luminosidade (lux) ou câmera |
| iPhone | câmera (o iOS não libera o sensor de luz para apps) |

---

## Estrutura

```
App.js                       tela do app
index.js                     ponto de entrada do Expo
app.json                     nome, ícone, identificadores e permissões
src/
├── vlc/
│   ├── receiver.js          lógica do receptor (porte do MainActivity.kt original)
│   └── referencia.js        texto de referência para a BER (antigo teste_vlc.txt)
└── light/
    ├── lightSensor.js       sensor de luminosidade (Android)
    └── CameraLightMeter.js  brilho da câmera (iPhone e Android)
tests/
└── simulacao.test.mjs       testes da lógica com um transmissor simulado
assets/                      ícones do app
```

A lógica (`src/vlc/receiver.js`) não depende de tela nem de plataforma: ela
recebe um valor de luz por leitura e devolve o estado pelos callbacks. As
fontes de luz ficam em `src/light/`. Assim dá para trocar a fonte sem mexer na
lógica, e testar a lógica no computador.

---

## Como rodar

Requisitos: Node.js 20 ou mais novo.

```bash
npm install
npm start
```

### iPhone (grátis, sem Xcode)

1. Instale o **Expo Go** pela App Store.
2. No computador, rode `npm start`. Aparece um QR code no terminal.
3. Com o iPhone **na mesma rede Wi-Fi** do computador, aponte a **Câmera** do
   iPhone para o QR code e toque no link. O app abre dentro do Expo Go.
4. Toque em **Iniciar** e permita o acesso à câmera.

Se o iPhone não estiver na mesma rede, use `npx expo start --tunnel`.

Um app próprio instalado no iPhone (com ícone separado, fora do Expo Go)
exige assinatura da Apple: conta Apple Developer (US$ 99/ano) para uso
permanente, ou Apple ID grátis com validade de 7 dias. Para gerar esse app:
`npx eas-cli@latest build -p ios`.

### Android

- **Expo Go:** instale o Expo Go pela Play Store e escaneie o QR code do
  `npm start` pelo próprio Expo Go.
- **APK:** `npx eas-cli@latest build -p android --profile preview` (na nuvem,
  conta Expo grátis) ou localmente, com Android Studio:
  ```bash
  npx expo prebuild -p android
  cd android && ./gradlew assembleRelease
  ```
  O APK fica em `android/app/build/outputs/apk/release/`.

### Testes

```bash
npm test
```

Simulam um transmissor (com ruído e relógio virtual) e conferem: mensagem
recebida com BER 0, taxas de 1 a 5 bit/s, leituras rápidas do sensor,
mensagem com tamanho diferente da referência, falta do marcador final e
espera sem flash.

---

## Histórico das mudanças

### Versão 1: app Android nativo (Kotlin)

O projeto começou como um app Android em Kotlin (`MainActivity.kt`), que lia
o sensor de luminosidade. Essa versão, e a versão híbrida intermediária,
estão guardadas na tag
[`versao-kotlin-e-hibrida`](../../tree/versao-kotlin-e-hibrida).

### Versão 2: Expo (atual)

Todo o projeto foi reestruturado em Expo, para gerar o app no iPhone e no
Android a partir de um único código.

**O que continua igual** (`src/vlc/receiver.js` é uma tradução direta do
`MainActivity.kt`):

- calibração de 700 ms com o flash apagado;
- detecção do flash com limiar = base + max(0,2; 1% da base);
- amostragem no meio de cada bit, com taxa de 1 a 5 bit/s;
- preâmbulo e marcador final `10101010`, com o marcador aceito só em bytes inteiros;
- limite de 1600 bits (200 caracteres);
- decodificação de 8 em 8 bits para ASCII;
- cálculo da BER contra o texto de referência;
- as mesmas mensagens de estado e o mesmo layout de tela;
- tela sempre ligada durante o uso.

**O que mudou:**

| | Versão 1 (Kotlin) | Versão 2 (Expo) |
|---|---|---|
| Linguagem | Kotlin | JavaScript (React Native) |
| Plataformas | Android | iPhone e Android |
| Fonte de luz | sensor de luminosidade | sensor (Android) ou câmera (iPhone e Android) |
| Organização | tela, sensor e lógica no `MainActivity.kt` | lógica, fontes de luz e tela em arquivos separados |
| Texto de referência | `assets/teste_vlc.txt` | `src/vlc/referencia.js` |
| Testes | nenhum | testes automáticos da lógica (`npm test`) |
| Ícone | ícone padrão do Android | ícone próprio |

**Por que a câmera:** o iPhone não dá acesso ao sensor de luz para nenhum
app. No iPhone, a luz é medida pelo brilho médio da imagem da câmera
(0 a 255). Como o `expo-camera` não dá acesso aos pixels, a medição roda numa
WebView com a câmera do aparelho, que também mostra a prévia para mirar o
transmissor.

### Pontos de atenção

- **Escala com a câmera:** a fórmula do limiar é a mesma, mas o valor é
  brilho (0 a 255), não lux. Em simulação, com ruído de cerca de 4% da base,
  um pico de ruído pode ser tomado como início do sinal. Se o receptor
  sincronizar sem flash, o limiar mínimo de 1% pode precisar aumentar.
- **Exposição automática:** o app tenta travar a exposição da câmera onde o
  aparelho permite. No iPhone isso não é possível. Use taxas baixas (1 a
  2 bit/s) e aponte o flash bem de frente para a câmera.
- **Testes em aparelho:** a lógica foi testada em simulação. A leitura pela
  câmera dentro do Expo Go ainda precisa ser testada em aparelhos reais.
