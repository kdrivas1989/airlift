import SwiftUI

struct MainView: View {
    @EnvironmentObject var api: APIClient
    @EnvironmentObject var terminal: TerminalManager

    @State private var searchText = ""
    @State private var selectedJumper: APIClient.Jumper?
    @State private var amountStr = ""
    @State private var successMsg = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Reader status
                HStack {
                    Circle()
                        .fill(terminal.isReaderConnected ? .green : .orange)
                        .frame(width: 8, height: 8)
                    Text(terminal.readerStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if !terminal.isReaderConnected {
                        Button("Retry") { terminal.discoverAndConnect() }
                            .font(.caption)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))

                // Search jumper
                VStack(alignment: .leading, spacing: 8) {
                    Text("Charge Customer")
                        .font(.headline)

                    TextField("Search jumper...", text: $searchText)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: searchText) { _, val in
                            guard val.count >= 2 else { return }
                            Task { try? await api.searchJumpers(query: val) }
                        }

                    if !api.jumpers.isEmpty && selectedJumper == nil {
                        ForEach(api.jumpers.prefix(5)) { j in
                            Button {
                                selectedJumper = j
                                searchText = j.displayName
                                api.jumpers = []
                            } label: {
                                HStack {
                                    Text(j.displayName).foregroundStyle(.primary)
                                    Spacer()
                                    Text(j.balanceStr).foregroundStyle(.green).font(.caption)
                                    Text("\(j.jumpBlockRemaining) blk").foregroundStyle(.blue).font(.caption)
                                }
                                .padding(.vertical, 6)
                            }
                            Divider()
                        }
                    }

                    if let j = selectedJumper {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(j.displayName).font(.subheadline.bold())
                                Text(j.email).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Clear") {
                                selectedJumper = nil
                                searchText = ""
                            }
                            .font(.caption)
                        }
                        .padding(12)
                        .background(Color(.systemGray6))
                        .cornerRadius(10)
                    }
                }
                .padding()

                // Amount
                VStack(alignment: .leading, spacing: 8) {
                    Text("Amount (before 3% CC fee)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    HStack {
                        Text("$")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        TextField("0.00", text: $amountStr)
                            .font(.title)
                            .keyboardType(.decimalPad)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)

                    if let base = Double(amountStr), base > 0 {
                        let fee = (base * 0.03 * 100).rounded() / 100
                        let total = base + fee
                        VStack(spacing: 4) {
                            HStack { Text("Amount").foregroundStyle(.secondary); Spacer(); Text(String(format: "$%.2f", base)) }
                            HStack { Text("3% CC fee").foregroundStyle(.secondary); Spacer(); Text(String(format: "$%.2f", fee)) }
                            Divider()
                            HStack { Text("Card total").fontWeight(.bold); Spacer(); Text(String(format: "$%.2f", total)).fontWeight(.bold) }
                            HStack { Text("Credits to account").foregroundStyle(.green); Spacer(); Text(String(format: "$%.2f", base)).foregroundStyle(.green) }
                        }
                        .font(.subheadline)
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(10)
                    }
                }
                .padding(.horizontal)

                Spacer()

                // Charge button
                if let base = Double(amountStr), base >= 0.5 {
                    let fee = (base * 0.03 * 100).rounded() / 100
                    let totalCents = Int((base + fee) * 100)

                    Button {
                        charge(totalCents: totalCents, baseCents: Int(base * 100))
                    } label: {
                        if terminal.isProcessing {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                        } else {
                            Text("Tap to Pay — \(String(format: "$%.2f", Double(totalCents) / 100))")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.indigo)
                    .padding()
                    .disabled(!terminal.isReaderConnected || terminal.isProcessing)
                }

                // Messages
                if !successMsg.isEmpty {
                    Text(successMsg)
                        .foregroundStyle(.green)
                        .font(.subheadline.bold())
                        .padding()
                }
                if let err = terminal.lastError {
                    Text(err)
                        .foregroundStyle(.red)
                        .font(.caption)
                        .padding(.horizontal)
                }
            }
            .navigationTitle("AirLIFT Pay")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text(api.userName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    func charge(totalCents: Int, baseCents: Int) {
        successMsg = ""
        terminal.collectPayment(
            amount: totalCents,
            jumperId: selectedJumper?.id,
            description: selectedJumper != nil ? "Payment for \(selectedJumper!.displayName)" : "AirLIFT payment"
        ) { piId in
            Task {
                try? await api.capturePayment(paymentIntentId: piId, jumperId: selectedJumper?.id, baseAmount: baseCents)
                successMsg = "Charged \(String(format: "$%.2f", Double(totalCents) / 100)) — \(String(format: "$%.2f", Double(baseCents) / 100)) credited"
                amountStr = ""
                selectedJumper = nil
                searchText = ""
            }
        }
    }
}
