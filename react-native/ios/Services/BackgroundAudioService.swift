//
//  BackgroundAudioService.swift
//  SwiftChat
//
//  Plays very low amplitude pink noise to keep the app alive in background.
//  Uses AVAudioSession .playback category with .mixWithOthers so it won't
//  interrupt user's music. The noise is generated programmatically at ~-60dB
//  (amplitude 0.001) which is inaudible but satisfies iOS audio session checks.
//

import AVFoundation

final class BackgroundAudioService: @unchecked Sendable {
    static let shared = BackgroundAudioService()

    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var isRunning = false
    private let lock = NSLock()

    private init() {}

    func start() {
        lock.lock()
        defer { lock.unlock() }

        guard !isRunning else { return }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try session.setActive(true)

            let engine = AVAudioEngine()
            let player = AVAudioPlayerNode()
            engine.attach(player)

            let format = AVAudioFormat(
                standardFormatWithSampleRate: 44100,
                channels: 1
            )!

            engine.connect(player, to: engine.mainMixerNode, format: format)
            // Set overall output volume very low as extra safety
            engine.mainMixerNode.outputVolume = 0.01

            try engine.start()
            player.play()

            // Schedule a looping buffer of pink noise at very low amplitude
            let buffer = generatePinkNoise(format: format, duration: 1.0)
            player.scheduleBuffer(buffer, at: nil, options: .loops)

            self.audioEngine = engine
            self.playerNode = player
            self.isRunning = true
        } catch {
            print("[BackgroundAudio] Failed to start: \(error)")
        }
    }

    func stop() {
        lock.lock()
        defer { lock.unlock() }

        guard isRunning else { return }

        playerNode?.stop()
        audioEngine?.stop()
        playerNode = nil
        audioEngine = nil
        isRunning = false

        // Deactivate with notifyOthers so user's music can resume
        try? AVAudioSession.sharedInstance().setActive(
            false,
            options: .notifyOthersOnDeactivation
        )
    }

    var running: Bool {
        lock.lock()
        defer { lock.unlock() }
        return isRunning
    }

    // MARK: - Pink Noise Generator

    /// Generates pink noise using the Voss-McCartney algorithm.
    /// Amplitude is set to ~0.001 (-60dB), completely inaudible.
    private func generatePinkNoise(
        format: AVAudioFormat,
        duration: Double
    ) -> AVAudioPCMBuffer {
        let frameCount = AVAudioFrameCount(format.sampleRate * duration)
        let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: frameCount
        )!
        buffer.frameLength = frameCount

        guard let channelData = buffer.floatChannelData?[0] else {
            return buffer
        }

        // Voss-McCartney pink noise: sum of multiple octave-band random values
        let numRows = 16
        var rows = [Float](repeating: 0, count: numRows)
        var runningSum: Float = 0

        for i in 0..<Int(frameCount) {
            // Find lowest set bit to determine which row to update
            let index = ctz(i)
            if index < numRows {
                let newRandom = Float.random(in: -1.0...1.0)
                runningSum -= rows[index]
                rows[index] = newRandom
                runningSum += newRandom
            }
            // Add white noise component and normalize
            let white = Float.random(in: -1.0...1.0)
            let pink = (runningSum + white) / Float(numRows + 1)
            // Scale to very low amplitude (~-60dB)
            channelData[i] = pink * 0.001
        }

        return buffer
    }

    /// Count trailing zeros (find lowest set bit position)
    private func ctz(_ value: Int) -> Int {
        if value == 0 { return 0 }
        var v = value
        var count = 0
        while v & 1 == 0 {
            v >>= 1
            count += 1
        }
        return count
    }
}
