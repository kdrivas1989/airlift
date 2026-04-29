import SwiftUI

struct LoginView: View {
    @EnvironmentObject var api: APIClient
    @State private var email = ""
    @State private var password = ""
    @State private var loading = false
    @State private var error = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("AirLIFT Pay")
                .font(.largeTitle.bold())
            Text("Tap to Pay Terminal")
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(.roundedBorder)

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
            }
            .padding(.horizontal, 32)

            if !error.isEmpty {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.caption)
            }

            Button {
                login()
            } label: {
                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                } else {
                    Text("Sign In")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.black)
            .padding(.horizontal, 32)
            .disabled(loading || email.isEmpty || password.isEmpty)

            Spacer()
        }
    }

    func login() {
        loading = true
        error = ""
        Task {
            do {
                try await api.login(email: email, password: password)
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}
