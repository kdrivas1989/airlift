import Foundation
import SwiftUI

@MainActor
class APIClient: ObservableObject {
    @Published var isLoggedIn = false
    @Published var userName = ""
    @Published var jumpers: [Jumper] = []

    private let baseURL = "https://airlift.kd-evolution.com"
    private var sessionCookie: String?

    struct Jumper: Identifiable, Codable {
        let id: Int
        let firstName: String
        let lastName: String
        let email: String
        let balance: Int
        let jumpBlockRemaining: Int

        var displayName: String { "\(firstName) \(lastName)" }
        var balanceStr: String { String(format: "$%.2f", Double(balance) / 100) }
    }

    func login(email: String, password: String) async throws {
        var req = URLRequest(url: URL(string: "\(baseURL)/api/auth")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password, "rememberMe": "true"])

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let httpRes = response as? HTTPURLResponse, httpRes.statusCode == 200 else {
            let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: body?["error"] as? String ?? "Login failed"])
        }

        // Capture session cookie
        if let cookies = HTTPCookieStorage.shared.cookies(for: URL(string: baseURL)!) {
            sessionCookie = cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        userName = json?["name"] as? String ?? ""
        isLoggedIn = true
    }

    func fetchConnectionToken() async throws -> String {
        let data = try await post(path: "/api/terminal/connection-token", body: [:])
        guard let secret = data["secret"] as? String else {
            throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "No connection token"])
        }
        return secret
    }

    func createPaymentIntent(amount: Int, jumperId: Int?, description: String) async throws -> (String, String) {
        var body: [String: Any] = ["amount": amount, "description": description]
        if let jid = jumperId { body["jumperId"] = jid }
        let data = try await post(path: "/api/terminal/payment-intent", body: body)
        guard let cs = data["clientSecret"] as? String, let piId = data["paymentIntentId"] as? String else {
            throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: data["error"] as? String ?? "Failed to create payment"])
        }
        return (cs, piId)
    }

    func capturePayment(paymentIntentId: String, jumperId: Int?, baseAmount: Int) async throws {
        var body: [String: Any] = ["paymentIntentId": paymentIntentId, "baseAmount": baseAmount]
        if let jid = jumperId { body["jumperId"] = jid }
        _ = try await post(path: "/api/terminal/capture", body: body)
    }

    func searchJumpers(query: String) async throws {
        let url = URL(string: "\(baseURL)/api/jumpers?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!
        var req = URLRequest(url: url)
        if let cookie = sessionCookie { req.setValue(cookie, forHTTPHeaderField: "Cookie") }
        let (data, _) = try await URLSession.shared.data(for: req)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let jArr = json?["jumpers"] as? [[String: Any]] ?? []
        jumpers = jArr.compactMap { j in
            guard let id = j["id"] as? Int,
                  let fn = j["firstName"] as? String,
                  let ln = j["lastName"] as? String else { return nil }
            return Jumper(
                id: id, firstName: fn, lastName: ln,
                email: j["email"] as? String ?? "",
                balance: j["balance"] as? Int ?? 0,
                jumpBlockRemaining: j["jumpBlockRemaining"] as? Int ?? 0
            )
        }
    }

    private func post(path: String, body: [String: Any]) async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let cookie = sessionCookie { req.setValue(cookie, forHTTPHeaderField: "Cookie") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let httpRes = response as? HTTPURLResponse, httpRes.statusCode < 300 else {
            let errBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: errBody?["error"] as? String ?? "Request failed"])
        }
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}
