import Foundation
import StripeTerminal
import SwiftUI

@MainActor
class TerminalManager: ObservableObject {
    @Published var isReaderConnected = false
    @Published var readerStatus = "Not connected"
    @Published var isProcessing = false
    @Published var lastError: String?

    private var api: APIClient?
    private var discoverCancelable: Cancelable?

    func initialize(api: APIClient) {
        self.api = api
        Terminal.setTokenProvider(ConnectionTokenProvider(api: api))

        if !Terminal.hasTokenProvider() { return }

        discoverAndConnect()
    }

    func discoverAndConnect() {
        readerStatus = "Discovering..."
        let config = DiscoveryConfiguration(
            discoveryMethod: .localMobile,
            simulated: false
        )

        discoverCancelable = Terminal.shared.discoverReaders(config, delegate: ReaderDiscoveryDelegate { [weak self] readers in
            guard let self, let reader = readers.first else {
                self?.readerStatus = "No reader found"
                return
            }
            self.readerStatus = "Connecting..."
            Terminal.shared.connectLocalMobileReader(reader, delegate: LocalMobileReaderDelegate()) { connectedReader, error in
                Task { @MainActor in
                    if let error {
                        self.readerStatus = "Failed: \(error.localizedDescription)"
                        self.lastError = error.localizedDescription
                    } else {
                        self.isReaderConnected = true
                        self.readerStatus = "Tap to Pay ready"
                    }
                }
            }
        })
    }

    func collectPayment(amount: Int, jumperId: Int?, description: String, onSuccess: @escaping (String) -> Void) {
        guard let api else { return }
        isProcessing = true
        lastError = nil

        Task {
            do {
                let (_, piId) = try await api.createPaymentIntent(amount: amount, jumperId: jumperId, description: description)

                // Retrieve the payment intent in Terminal
                Terminal.shared.retrievePaymentIntent(clientSecret: piId) { intent, error in
                    if let error {
                        Task { @MainActor in
                            self.isProcessing = false
                            self.lastError = error.localizedDescription
                        }
                        return
                    }

                    guard let intent else { return }

                    // Collect payment method (tap)
                    Terminal.shared.collectPaymentMethod(intent) { collectedIntent, error in
                        if let error {
                            Task { @MainActor in
                                self.isProcessing = false
                                self.lastError = error.localizedDescription
                            }
                            return
                        }

                        guard let collectedIntent else { return }

                        // Confirm the payment
                        Terminal.shared.confirmPaymentIntent(collectedIntent) { confirmedIntent, error in
                            Task { @MainActor in
                                self.isProcessing = false
                                if let error {
                                    self.lastError = error.localizedDescription
                                } else if let confirmedIntent {
                                    onSuccess(confirmedIntent.stripeId)
                                }
                            }
                        }
                    }
                }
            } catch {
                self.isProcessing = false
                self.lastError = error.localizedDescription
            }
        }
    }
}

// MARK: - Stripe Terminal Delegates

class ConnectionTokenProvider: ConnectionTokenProvider {
    private let api: APIClient

    init(api: APIClient) { self.api = api }

    func fetchConnectionToken(_ completion: @escaping ConnectionTokenCompletionBlock) {
        Task {
            do {
                let token = try await api.fetchConnectionToken()
                completion(token, nil)
            } catch {
                completion(nil, error)
            }
        }
    }
}

class ReaderDiscoveryDelegate: NSObject, DiscoveryDelegate {
    private let onUpdate: ([Reader]) -> Void

    init(onUpdate: @escaping ([Reader]) -> Void) {
        self.onUpdate = onUpdate
    }

    func terminal(_ terminal: Terminal, didUpdateDiscoveredReaders readers: [Reader]) {
        onUpdate(readers)
    }
}

class LocalMobileReaderDelegate: NSObject, LocalMobileReaderDelegate {
    func localMobileReader(_ reader: Reader, didStartInstallingUpdate update: ReaderSoftwareUpdate, cancelable: Cancelable?) {}
    func localMobileReader(_ reader: Reader, didReportReaderSoftwareUpdateProgress progress: Float) {}
    func localMobileReader(_ reader: Reader, didFinishInstallingUpdate update: ReaderSoftwareUpdate?, error: Error?) {}
    func localMobileReaderDidAcceptTermsOfService(_ reader: Reader) {}
}
