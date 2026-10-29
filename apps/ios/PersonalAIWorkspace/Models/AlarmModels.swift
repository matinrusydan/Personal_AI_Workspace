import Foundation

/// State of an alarm on the device per docs/IOS_ALARM.md
public enum DeviceAlarmState: String, Codable {
    case pendingSync = "pending_sync"
    case scheduleRequested = "schedule_requested"
    case scheduled = "scheduled"
    case failed = "failed"
    case canceled = "canceled"
    case acknowledged = "acknowledged"
    case snoozed = "snoozed"
    case unknown = "unknown"
}

/// Item received from backend /api/v1/devices/alarms
public struct DesiredAlarm: Codable, Identifiable {
    public var id: String { occurrenceId }
    public let occurrenceId: String
    public let scheduledFor: Date
    public let title: String
    public let version: Int

    public init(occurrenceId: String, scheduledFor: Date, title: String, version: Int) {
        self.occurrenceId = occurrenceId
        self.scheduledFor = scheduledFor
        self.title = title
        self.version = version
    }
}

/// Result of local on-device scheduling reported to /api/v1/devices/alarms/:id/status
public struct DeviceAlarmStatusReport: Codable {
    public let platformAlarmId: String?
    public let status: String // scheduled, failed, permission_denied, canceled
    public let errorMessage: String?

    public init(platformAlarmId: String?, status: String, errorMessage: String? = nil) {
        self.platformAlarmId = platformAlarmId
        self.status = status
        self.errorMessage = errorMessage
    }
}

/// Local offline-buffered acknowledgment or snooze action
public struct OfflineAction: Codable {
    public let occurrenceId: String
    public let action: String // acknowledge, snooze
    public let clientRequestId: String
    public let minutes: Int?
    public let timestamp: Date

    public init(occurrenceId: String, action: String, clientRequestId: String, minutes: Int? = nil, timestamp: Date = Date()) {
        self.occurrenceId = occurrenceId
        self.action = action
        self.clientRequestId = clientRequestId
        self.minutes = minutes
        self.timestamp = timestamp
    }
}
