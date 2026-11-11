
package com.example.ook_disp_fot_rx

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale
import kotlin.math.max

class MainActivity : AppCompatActivity(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var lightSensor: Sensor? = null

    private lateinit var textLux: TextView
    private lateinit var textBits: TextView
    private lateinit var textMessage: TextView
    private lateinit var editBitrate: EditText

    private val handler = Handler(Looper.getMainLooper())

    // Mesmo protocolo do transmissor
    private val preamble = "10101010"
    private val endMarker = "10101010"

    private var bitRate = 1
    private var bitPeriod = 1000L

    // Medidas do sensor
    private var currentLux = 0f
    private var baselineLux = 0f
    private var highLux = 0f
    private var thresholdLux = 0f

    private var calibrationCount = 0
    private var calibrationSum = 0.0

    // Estados
    private var sampling = false
    private var synchronized = false
    private var receiving = false

    private var bitBuffer = ""
    private var dataBuffer = ""

    private var calibrationEnd = 0L
    private var nextSampleTime = 0L

    private val maxPayloadBits = 1600

    private val sampleRunnable = object : Runnable {
        override fun run() {

            if (!sampling || !synchronized) return

            sampleBit()

            if (sampling && synchronized) {
                nextSampleTime += bitPeriod

                handler.postAtTime(
                    this,
                    nextSampleTime
                )
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        textLux = findViewById(R.id.textLux)
        textBits = findViewById(R.id.textBits)
        textMessage = findViewById(R.id.textMessage)
        editBitrate = findViewById(R.id.editBitrate)

        val btnStart =
            findViewById<Button>(R.id.btnStartRx)

        val btnStop =
            findViewById<Button>(R.id.btnStopRx)

        sensorManager =
            getSystemService(Context.SENSOR_SERVICE)
                    as SensorManager

        lightSensor = sensorManager.getDefaultSensor(
            Sensor.TYPE_LIGHT
        )

        btnStart.setOnClickListener {

            bitRate = editBitrate.text.toString()
                .toIntOrNull()
                ?.coerceIn(1, 5) ?: 1

            bitPeriod = 1000L / bitRate

            startReception()
        }

        btnStop.setOnClickListener {
            stopReception()
        }
    }

    // =========================================
    // INICIAR RECEPCAO
    // =========================================

    private fun startReception() {

        stopReception()

        if (lightSensor == null) {
            textMessage.text =
                "Erro: sensor de luminosidade indisponível."
            return
        }

        bitBuffer = ""
        dataBuffer = ""

        calibrationCount = 0
        calibrationSum = 0.0

        baselineLux = 0f
        highLux = 0f
        thresholdLux = 0f

        synchronized = false
        receiving = false
        sampling = true

        textBits.text = ""

        textMessage.text =
            "Calibrando sensor...\n" +
                    "Inicie a transmissão após a calibração."

        calibrationEnd =
            SystemClock.uptimeMillis() + 700L

        val registered = sensorManager.registerListener(
            this,
            lightSensor,
            SensorManager.SENSOR_DELAY_FASTEST
        )

        if (!registered) {
            sampling = false
            textMessage.text =
                "Erro ao registrar sensor de luminosidade."
        }
    }

    // =========================================
    // PARAR RECEPCAO
    // =========================================

    private fun stopReception() {

        sampling = false
        synchronized = false
        receiving = false

        handler.removeCallbacks(sampleRunnable)

        if (::sensorManager.isInitialized) {
            sensorManager.unregisterListener(this)
        }
    }

    // =========================================
    // LEITURA DO SENSOR
    // =========================================

    override fun onSensorChanged(event: SensorEvent) {

        if (!sampling || event.sensor.type != Sensor.TYPE_LIGHT) {
            return
        }

        currentLux = event.values[0]

        val now = SystemClock.uptimeMillis()

        // Calibracao inicial com o flash apagado
        if (now < calibrationEnd) {

            calibrationSum += currentLux
            calibrationCount++

            textLux.text = String.format(
                Locale.US,
                "Lux: %.2f\nCalibrando...",
                currentLux
            )

            return
        }

        if (calibrationCount == 0) {
            baselineLux = currentLux
        } else if (baselineLux == 0f && !synchronized) {
            baselineLux =
                (calibrationSum / calibrationCount).toFloat()
        }

        if (!synchronized) {

            // Diferenca minima para identificar o flash
            val triggerDelta = max(
                0.2f,
                baselineLux * 0.01f
            )

            thresholdLux = baselineLux + triggerDelta

            // Primeira subida: inicio do preambulo
            if (currentLux > thresholdLux) {

                synchronized = true

                highLux = currentLux

                nextSampleTime =
                    now + bitPeriod / 2L

                handler.postAtTime(
                    sampleRunnable,
                    nextSampleTime
                )

                textMessage.text =
                    "Sinal detectado.\n" +
                            "Sincronizando preâmbulo..."
            }

        } else {

            // Estima o nivel luminoso do bit 1
            if (currentLux > highLux) {
                highLux = currentLux
            }

            // Limiar entre niveis baixo e alto
            thresholdLux =
                baselineLux +
                        (highLux - baselineLux) * 0.5f
        }

        textLux.text = String.format(
            Locale.US,
            "Lux: %.2f\n" +
                    "Base: %.2f\n" +
                    "Pico: %.2f\n" +
                    "Limiar: %.2f",
            currentLux,
            baselineLux,
            highLux,
            thresholdLux
        )
    }

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int
    ) {
    }

    // =========================================
    // AMOSTRAGEM DOS BITS
    // =========================================

    private fun sampleBit() {

        val bit = if (currentLux > thresholdLux) {
            "1"
        } else {
            "0"
        }

        processBit(bit)
    }

    // =========================================
    // PROCESSAMENTO DOS BITS
    // =========================================

    private fun processBit(bit: String) {

        bitBuffer += bit

        if (bitBuffer.length > 200) {
            bitBuffer = bitBuffer.takeLast(200)
        }

        textBits.text = bitBuffer.takeLast(120)

        // Procurar preambulo
        if (!receiving) {

            if (bitBuffer.endsWith(preamble)) {

                receiving = true
                dataBuffer = ""

                textMessage.text =
                    "Preâmbulo detectado.\n" +
                            "Recebendo mensagem..."
            }

            return
        }

        dataBuffer += bit

        // O marcador final so pode aparecer
        // depois de um numero inteiro de bytes
        val payloadLength =
            dataBuffer.length - endMarker.length

        if (
            dataBuffer.endsWith(endMarker) &&
            payloadLength >= 0 &&
            payloadLength % 8 == 0
        ) {

            val usefulBits =
                dataBuffer.substring(0, payloadLength)

            finishReception(usefulBits)
            return
        }

        // Limite correspondente a 200 caracteres
        if (dataBuffer.length > maxPayloadBits + 8) {

            stopReception()

            textMessage.text =
                "Erro: limite de dados atingido.\n" +
                        "Marcador final não identificado."
        }
    }

    // =========================================
    // FINALIZAR RECEPCAO
    // =========================================

    private fun finishReception(bits: String) {

        stopReception()

        val message = decodeMessage(bits)

        textMessage.text =
            "Mensagem recebida:\n$message\n\n" +
                    "Bits úteis: ${bits.length}"

        calculateBER(bits)
    }

    // =========================================
    // DECODIFICAR TEXTO
    // =========================================

    private fun decodeMessage(bits: String): String {

        val message = StringBuilder()

        for (i in bits.indices step 8) {

            if (i + 8 > bits.length) break

            val byte = bits.substring(i, i + 8)

            val char = byte.toInt(2).toChar()

            message.append(char)
        }

        return message.toString()
    }

    // =========================================
    // CALCULAR BER
    // =========================================

    private fun calculateBER(receivedBits: String) {

        val originalText = try {

            readTextFromAssets("teste_vlc.txt").take(200)

        } catch (e: Exception) {

            textMessage.append(
                "\n\nBER indisponível: " +
                        "arquivo teste_vlc.txt não encontrado."
            )

            return
        }

        val expectedBits = convertToBinary(originalText)

        if (expectedBits.isEmpty()) {

            textMessage.append(
                "\n\nBER indisponível: referência vazia."
            )
            return
        }

        // A BER posicional so e valida com
        // os bits corretamente alinhados
        if (receivedBits.length != expectedBits.length) {

            textMessage.append(
                "\n\nBER não calculada: " +
                        "comprimento diferente da referência." +
                        "\nEsperados: ${expectedBits.length}" +
                        "\nRecebidos: ${receivedBits.length}"
            )

            return
        }

        var errors = 0

        for (i in expectedBits.indices) {

            if (receivedBits[i] != expectedBits[i]) {
                errors++
            }
        }

        val ber =
            errors.toDouble() / expectedBits.length

        textMessage.append(
            String.format(
                Locale.US,
                "\n\nBER: %.6f\nErros: %d / %d",
                ber,
                errors,
                expectedBits.length
            )
        )
    }

    // =========================================
    // LER ARQUIVO DE REFERENCIA
    // =========================================

    private fun readTextFromAssets(
        fileName: String
    ): String {

        val stringBuilder = StringBuilder()

        assets.open(fileName).bufferedReader().useLines {
                lines ->

            lines.forEach {
                stringBuilder.append(it)
            }
        }

        return stringBuilder.toString()
    }

    // =========================================
    // TEXTO PARA BINARIO
    // =========================================

    private fun convertToBinary(text: String): String {

        val binary = StringBuilder()

        for (char in text) {

            binary.append(
                char.code.toString(2).padStart(8, '0')
            )
        }

        return binary.toString()
    }

    // =========================================
    // ENCERRAR ACTIVITY
    // =========================================

    override fun onDestroy() {

        stopReception()
        super.onDestroy()
    }
}
