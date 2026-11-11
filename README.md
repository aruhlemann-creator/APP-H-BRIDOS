# Receptor VLC (OOK)

Receptor de comunicação por luz visível (On-Off Keying). O app calibra o nível
de luz ambiente, detecta o flash do transmissor, sincroniza pelo preâmbulo
`10101010`, decodifica a mensagem em ASCII e calcula a BER comparando com
`teste_vlc.txt`.

O repositório tem duas versões do mesmo receptor:

| Pasta | Versão | Linguagem | Roda em | Fonte de luz |
|---|---|---|---|---|
| `app/` | original (nativa) | Kotlin | Android | sensor de luminosidade |
| `hibrido/` | híbrida | HTML, CSS e JavaScript | iPhone, Android e computador | câmera |

---

## O que mudou em relação ao projeto original

### O projeto original foi mantido

A pasta `app/` (Kotlin) não foi alterada. `MainActivity.kt`, o layout, o
manifest e a configuração do Gradle do app continuam como estavam, e ela
continua lendo o sensor de luminosidade do Android.

Na raiz do repositório foram adicionados:

- `README.md` (este arquivo);
- `.github/workflows/pages.yml`, que publica a versão web no GitHub Pages;
- duas linhas no `.gitignore` (`.kotlin` e `node_modules`).

### Nova versão híbrida (`hibrido/`)

A lógica do receptor foi convertida de Kotlin para JavaScript, para o mesmo
código rodar em qualquer aparelho.

**O que continua igual** (`hibrido/www/receiver.js` é uma tradução direta
do `MainActivity.kt`):

- calibração de 700 ms com o flash apagado;
- detecção do flash com limiar = base + max(0,2; 1% da base);
- amostragem no meio de cada bit, com taxa de 1 a 5 bit/s;
- preâmbulo e marcador final `10101010`, com o marcador aceito só em bytes inteiros;
- limite de 1600 bits (200 caracteres);
- decodificação de 8 em 8 bits para ASCII;
- cálculo da BER contra `teste_vlc.txt`;
- as mesmas mensagens de estado na tela.

**O que mudou:**

| | Original (`app/`) | Híbrido (`hibrido/`) |
|---|---|---|
| Linguagem | Kotlin | JavaScript, HTML e CSS |
| Plataformas | Android | iPhone, Android e navegador |
| Fonte de luz | sensor de luminosidade (lux) | câmera (brilho médio da imagem, 0 a 255) |
| Tela | layout XML | mesmo visual em HTML, mais o seletor "Fonte de luz" e a prévia da câmera |
| Temporização dos bits | `Handler.postAtTime` | `setTimeout` com horário absoluto (sem acúmulo de atraso) |
| Instalação | APK | app web na tela inicial (PWA) ou APK gerado com Capacitor |
| Ícone | ícone padrão do Android | ícone próprio (`hibrido/icon.svg`) |

**Por que a câmera em vez do sensor:** o iPhone e os navegadores não dão
acesso ao sensor de luz para nenhum app. A câmera é o único sensor de luz
disponível em todas as plataformas. A opção "Sensor de luminosidade" continua
no código e aparece apenas onde o navegador oferece a API `AmbientLightSensor`.

### Reorganização do código

No original, o `MainActivity.kt` concentrava tela, leitura do sensor e lógica.
Na versão híbrida, essas partes ficaram separadas:

```
hibrido/
├── www/                     app web (o mesmo código para todas as plataformas)
│   ├── index.html           estrutura da tela
│   ├── style.css            visual
│   ├── receiver.js          lógica do receptor (porte do MainActivity.kt)
│   ├── lightsensor.js       leitura da luz (câmera ou sensor)
│   ├── assets/teste_vlc.txt referência para a BER
│   ├── manifest.webmanifest instalação na tela inicial
│   └── sw.js                funcionamento offline
└── android/                 projeto Android (Capacitor) que empacota www/ em APK
```

`receiver.js` recebe um número por leitura e não depende da plataforma. Só o
`lightsensor.js` sabe de onde vem a luz. Assim, a fonte de luz pode mudar sem
mexer na lógica.

### Pontos de atenção

- **Escala do valor:** a fórmula do limiar é a mesma, mas com a câmera o valor
  é brilho (0 a 255), não lux. A tela continua mostrando o rótulo "Lux".
  Em simulação, com ruído de cerca de 4% da base, um pico de ruído pode ser
  tomado como início do sinal. Se o receptor sincronizar sem flash, o limiar
  mínimo de 1% pode precisar aumentar.
- **Exposição automática:** o app tenta travar a exposição da câmera onde o
  aparelho permite (Chrome no Android). No iPhone isso não é possível. Use
  taxas baixas (1 a 2 bit/s) e aponte o flash bem de frente para a câmera.
- **Testes:** a lógica foi testada em simulação (mensagem "ABCDEFGH" a
  5 bit/s, BER 0). A leitura pela câmera ainda precisa ser testada em
  aparelhos reais.

---

## Como usar

**iPhone, Android ou computador (versão web):** abra o link do GitHub Pages
deste repositório. No iPhone, abra no Safari e toque em Compartilhar →
Adicionar à Tela de Início. A câmera exige HTTPS.

**Android (APK):** veja as instruções de build em
[hibrido/README.md](hibrido/README.md).

**App original:** abra a raiz do repositório no Android Studio e rode o
módulo `app`.
