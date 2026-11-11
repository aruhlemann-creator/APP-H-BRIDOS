# Receptor VLC (OOK)

Aplicativo que **recebe mensagens enviadas por luz**. Um celular (o
transmissor) pisca o flash, e este app lê essas piscadas pela câmera ou pelo
sensor de luz, transforma em texto e mostra a taxa de erro (BER).

Funciona no **iPhone** e no **Android**.

| Celular | Como o app lê a luz |
|---|---|
| Android | sensor de luz do celular ou câmera |
| iPhone | câmera (o iPhone não deixa apps usarem o sensor de luz) |

---

# Guia passo a passo (para quem nunca programou)

Você vai precisar de:

- um **computador** (Mac ou Windows) com internet;
- um **celular** (iPhone ou Android) **na mesma rede Wi-Fi** do computador.

O computador "liga" o app, e o celular abre o app lendo um QR code.

## Parte 1: preparar o computador (só na primeira vez)

### 1. Instalar o Node.js

O Node.js é o programa que faz o projeto rodar.

1. Entre em **https://nodejs.org**.
2. Clique no botão verde **LTS** (a versão recomendada) e baixe.
3. Abra o arquivo baixado e clique em **Continuar / Próximo** até terminar.

### 2. Baixar o projeto

1. Entre na página do projeto no GitHub:
   **https://github.com/aruhlemann-creator/APP-H-BRIDOS**
2. Clique no botão verde **Code** e depois em **Download ZIP**.
3. Abra a pasta **Downloads** e dê dois cliques no arquivo
   `APP-H-BRIDOS-main.zip`. Vai aparecer a pasta **APP-H-BRIDOS-main**.

### 3. Abrir o Terminal na pasta do projeto

O Terminal é uma janela onde você digita comandos.

**No Mac:**
1. Abra o **Finder** e vá até a pasta **APP-H-BRIDOS-main**.
2. Clique com o **botão direito** na pasta e escolha
   **Serviços → Novo Terminal na Pasta**.
   (Se não aparecer, abra o app **Terminal**, digite `cd ` com um espaço no
   final, arraste a pasta para dentro da janela e aperte **Enter**.)

**No Windows:**
1. Abra a pasta **APP-H-BRIDOS-main** no Explorador de Arquivos.
2. Clique na barra de endereço lá em cima, apague o que estiver escrito,
   digite `cmd` e aperte **Enter**.

Vai abrir uma janela de texto. É nela que você digita os comandos abaixo.

### 4. Instalar as peças do projeto

Digite o comando abaixo e aperte **Enter**:

```
npm install
```

Espere terminar (pode levar alguns minutos). Vão aparecer várias linhas;
é normal. Quando o cursor voltar a piscar, terminou.

> Só precisa fazer isso **uma vez**. Nas próximas vezes, pule direto para a Parte 3.

## Parte 2: preparar o celular (só na primeira vez)

Instale o app **Expo Go** (grátis):

- **iPhone:** App Store → procure **Expo Go** → Obter.
- **Android:** Play Store → procure **Expo Go** → Instalar.

## Parte 3: abrir o app (toda vez que for usar)

1. No Terminal, dentro da pasta do projeto, digite e aperte **Enter**:

   ```
   npm start
   ```

2. Espere aparecer um **QR code** (um quadrado de pontinhos) no Terminal.
3. Abra o app no celular:
   - **iPhone:** abra a **Câmera** normal do iPhone, aponte para o QR code e
     toque no aviso amarelo **"Abrir no Expo Go"**.
   - **Android:** abra o **Expo Go** e toque em **Scan QR code**. Aponte para
     o QR code.
4. Espere carregar (na primeira vez demora um pouco). Vai aparecer a tela
   **Receptor VLC**.

**Para desligar:** no Terminal, aperte as teclas **Ctrl** e **C** juntas.

> Deixe o Terminal aberto enquanto estiver usando o app. Se fechar o
> Terminal, o app para de funcionar no celular.

## Parte 4: usar o app

1. Em **Taxa de bits**, digite um número de **1 a 5**. Use o **mesmo número
   configurado no transmissor**. Comece com **1** ou **2**, que funcionam melhor.
2. Em **Fonte de luz**, escolha:
   - **Sensor de luz** (só aparece no Android): o sensor fica perto da câmera
     de selfie, no alto da tela;
   - **Câmera frontal** ou **Câmera traseira**: aparece uma imagem da câmera
     para você mirar.
3. Aponte o flash do transmissor **bem de frente** para o sensor ou a câmera
   escolhida, **com o flash apagado**.
4. Toque em **INICIAR**. Na primeira vez, o celular pergunta se pode usar a
   câmera: toque em **Permitir**.
5. Espere aparecer **"Calibrando sensor..."** e, logo depois, comece a
   transmissão no outro celular.
6. Acompanhe na tela:
   - **Sensor / Luz na Câmera:** o nível de luz medido agora;
   - **Bits Recebidos:** os 0 e 1 que estão chegando;
   - **Mensagem Decodificada:** o texto recebido e a **BER**
     (0,000000 = nenhum erro).
7. Para parar antes do fim, toque em **PARAR**.

## Se der algum problema

| O que aconteceu | O que fazer |
|---|---|
| `npm: command not found` ou `'npm' não é reconhecido` | O Node.js não foi instalado. Volte ao passo 1 da Parte 1 e depois **feche e abra o Terminal de novo**. |
| O celular não abre o app pelo QR code | Confira se o celular e o computador estão **no mesmo Wi-Fi**. Se não der, desligue com **Ctrl + C** e rode `npx expo start --tunnel`. |
| Aparece "Erro: sem permissão para usar a câmera" | Vá em **Ajustes** do celular → **Expo Go** → ative **Câmera**. |
| A mensagem não chega ou chega errada | Use taxa **1**, deixe o ambiente mais escuro e aproxime o flash. |
| Aparece "Sinal detectado" sem o flash ligar | A luz do ambiente está variando. Deixe o ambiente com luz constante e toque em **INICIAR** de novo. |
| "BER não calculada: comprimento diferente" | O texto enviado é diferente do texto de referência (veja "Texto de referência" abaixo). |
| Qualquer outro erro no Terminal | Rode `npm install` de novo e depois `npm start`. |

### Texto de referência

A BER compara a mensagem recebida com o texto do arquivo
`src/vlc/referencia.js` (hoje: `ABCDEFGH`). Se o transmissor enviar outro
texto, abra esse arquivo em qualquer editor de texto, troque o que está entre
as aspas e salve.

---

# Parte técnica

## Estrutura

```
App.js                       tela do app
index.js                     ponto de entrada do Expo
app.json                     nome, ícone, identificadores e permissões
src/
├── vlc/
│   ├── receiver.js          lógica do receptor (porte do MainActivity.kt original)
│   └── referencia.js        texto de referência para a BER
└── light/
    ├── lightSensor.js       sensor de luminosidade (Android)
    └── CameraLightMeter.js  brilho da câmera (iPhone e Android)
tests/
└── simulacao.test.mjs       testes da lógica com um transmissor simulado
assets/                      ícones do app (icon.svg é o desenho editável)
```

A lógica (`src/vlc/receiver.js`) não depende de tela nem de plataforma: ela
recebe um valor de luz por leitura e devolve o estado pelos callbacks. As
fontes de luz ficam em `src/light/`.

## Comandos

| Comando | Para que serve |
|---|---|
| `npm install` | instala as dependências |
| `npm start` | inicia o servidor do Expo e mostra o QR code |
| `npx expo start --tunnel` | igual ao anterior, para celular em outra rede |
| `npm test` | roda os testes da lógica do receptor |

## Testes

`npm test` simula um transmissor (com ruído e relógio virtual) e confere:
mensagem recebida com BER 0, taxas de 1 a 5 bit/s, leituras rápidas do
sensor, mensagem com tamanho diferente da referência, falta do marcador
final e espera sem flash.

## Gerar um app instalável

- **Android (APK):** `npx eas-cli@latest build -p android --profile preview`
  (na nuvem, com conta Expo grátis), ou localmente com Android Studio:
  `npx expo prebuild -p android` e depois `cd android && ./gradlew assembleRelease`.
  O APK fica em `android/app/build/outputs/apk/release/`.
- **iPhone:** um app próprio fora do Expo Go precisa da assinatura da Apple:
  conta Apple Developer (US$ 99/ano) para uso permanente, ou Apple ID grátis
  com validade de 7 dias. Comando: `npx eas-cli@latest build -p ios`.

A pasta `android/` é gerada pelo Expo e não fica no repositório.

---

# Histórico das mudanças

### Versão 1: app Android nativo (Kotlin)

O projeto começou como um app Android em Kotlin (`MainActivity.kt`), que lia
o sensor de luminosidade. Essa versão e a versão híbrida intermediária estão
guardadas na tag
[`versao-kotlin-e-hibrida`](../../tree/versao-kotlin-e-hibrida).

### Versão 2: Expo (atual)

O projeto foi reestruturado em Expo, para gerar o app no iPhone e no Android
a partir de um único código.

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
app. Lá, a luz é medida pelo brilho médio da imagem da câmera (0 a 255). Como
o `expo-camera` não dá acesso aos pixels, a medição roda numa WebView com a
câmera do aparelho, que também mostra a prévia para mirar o transmissor.

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
