import SwiftUI

@main
struct AirLIFTPayApp: App {
    @StateObject private var api = APIClient()
    @StateObject private var terminal = TerminalManager()

    var body: some Scene {
        WindowGroup {
            if api.isLoggedIn {
                MainView()
                    .environmentObject(api)
                    .environmentObject(terminal)
                    .onAppear {
                        terminal.initialize(api: api)
                    }
            } else {
                LoginView()
                    .environmentObject(api)
            }
        }
    }
}
