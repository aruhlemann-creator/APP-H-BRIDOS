# Receptor VLC (OOK)

Receptor de comunicação por luz visível (On-Off Keying): calibra o nível de
luz ambiente, detecta o flash do transmissor, sincroniza pelo preâmbulo
`10101010`, decodifica a mensagem em ASCII e calcula a BER contra
`teste_vlc.txt`.

## Pastas

- `hibrido/` — app híbrido em HTML/CSS/JavaScript (PWA). Roda em iPhone,
  Android e computador pelo navegador e pode ser instalado na tela inicial.
  Lê a luz pela câmera. Detalhes em [hibrido/README.md](hibrido/README.md).
- `app/` — app Android nativo original (Kotlin), que usa o sensor de
  luminosidade.

## Usar no iPhone

Abra o link do GitHub Pages deste repositório no Safari →
Compartilhar → Adicionar à Tela de Início.
