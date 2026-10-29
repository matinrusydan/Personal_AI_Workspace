import Foundation

/// Device synchronization service communicating with backend /api/v1
/// Reconciles desired alarm state and flushes buffered offline actions per docs/IOS_ALARM.md
public final class DeviceSyncService {
    public static let shared = DeviceSyncService()

    private let baseURL: URL
    private let session: URLSession
    private let installIdKey = "paw_device_install_id"
    private let deviceIdKey = "paw_device_id"

    public init(baseURL: URL = URL(string: "http://127.0.0.1:4000/api/v1")!) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        self.session = URLSession(configuration: config)
    }

    /// Returns or creates a persistent unique installation ID for this iPhone 12
    public func getInstallId() -> String {
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: installIdKey) {
            return existing
        }
        let newId = "iphone12-\(UUID().uuidString)"
        defaults.set(newId, forKey: installIdKey)
        return newId
    }

    /// Enrolls or heartbeat device with backend
    public func enrollDevice(deviceName: String = "Matin iPhone 12", token: String? = nil) async throws -> String {
        let installId = getInstallId()
        let url = baseURL.appendingPathComponent("devices/register")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body: [String: Any] = [
            "platform": "ios",
            "installId": installId,
            "deviceName": deviceName
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let dataObj = json["data"] as? [String: Any],
           let devId = dataObj["id"] as? String {
            UserDefaults.standard.set(devId, forKey: deviceIdKey)
            return devId
        }

        return installId
    }

    /// Fetches desired alarms delta from backend
    public func fetchDesiredAlarms(token: String? = nil) async throws -> [DesiredAlarm] {
        let url = baseURL.appendingPathComponent("devices/alarms")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        struct ResponseContainer: Codable {
            let data: [DesiredAlarm]
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let container = try decoder.decode(ResponseContainer.self, from: data)
        return container.data
    }

    /// Reports scheduling result back to server
    public func reportAlarmStatus(occurrenceId: String, report: DeviceAlarmStatusReport, token: String? = nil) async throws {
        let url = baseURL.appendingPathComponent("devices/alarms/\(occurrenceId)/status")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(report)

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    /// Flushes locally buffered offline acknowledgments/snoozes when online
    public func flushOfflineActions(actions: [OfflineAction], token: String? = nil) async -> [String] {
        var successfullyFlushed: [String] = []

        for action in actions {
            do {
                let endpoint = action.action == "snooze" ? "snooze" : "acknowledge"
                let url = baseURL.appendingPathComponent("reminders/\(action.occurrenceId)/\(endpoint)")
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = token {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }

                var body: [String: Any] = [
                    "clientRequestId": action.clientRequestId
                ]
                if let mins = action.minutes, action.action == "snooze" {
                    body["minutes"] = mins
                }
                request.httpBody = try JSONSerialization.data(withJSONObject: body)

                let (_, response) = try await session.data(for: request)
                if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                    successfullyFlushed.append(action.clientRequestId)
                }
            } catch {
                // Keep in buffer for next retry
            }
        }

        return successfullyFlushed
    }
}
