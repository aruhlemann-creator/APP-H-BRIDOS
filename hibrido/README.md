# Receptor VLC — app web (PWA) para qualquer dispositivo

Um único código em HTML/CSS/JavaScript (`www/`), aberto por um link no
navegador. Funciona em iPhone, Android, computador e tablet, e pode ser
instalado na tela inicial como um app (ícone próprio, tela cheia, offline).

## Lógica (igual ao app Android original)

`www/receiver.js` é o porte direto do `MainActivity.kt`:
calibração de 700 ms, detecção do flash (limiar base + max(0,2; 1%)),
amostragem no meio do bit, preâmbulo e marcador final `10101010`,
limite de 1600 bits, decodificação em ASCII e BER contra `teste_vlc.txt`.

## Fonte de luz (`www/lightsensor.js`)

- **Câmera** (frontal ou traseira): brilho médio da imagem (0–255). Funciona
  em qualquer navegador com câmera. A tela mostra "Lux", mas nesse modo o
  valor é brilho.
- **Sensor de luminosidade**: só em navegadores com a API AmbientLightSensor
  (hoje quase nenhum por padrão). A opção some quando não existe.

O app tenta travar a exposição automática da câmera onde o navegador permite
(Chrome no Android). No iPhone isso não é possível; use taxas baixas e
aponte o flash bem de frente para a câmera.

## Publicar

Coloque a pasta `www/` em qualquer hospedagem com **HTTPS** (a câmera exige
HTTPS). Exemplo sem instalar nada: arraste `www/` em https://app.netlify.com/drop.

## Instalar no aparelho

- **iPhone/iPad**: abra o link no Safari → Compartilhar → Adicionar à Tela de Início.
- **Android**: abra no Chrome → menu ⋮ → Instalar app / Adicionar à tela inicial.
- **Computador**: no Chrome/Edge, ícone de instalar na barra de endereço.

## Testar localmente

```bash
npm start      # abre em http://localhost:3000
```
