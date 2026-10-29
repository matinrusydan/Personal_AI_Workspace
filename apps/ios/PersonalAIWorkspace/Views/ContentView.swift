import SwiftUI

public struct ContentView: View {
    @StateObject private var alarmManager = AlarmKitManager.shared
    @State private var isSyncing: Bool = false
    @State private var syncStatusMessage: String = "Ready"

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                // Section 1: AlarmKit Authorization & Readiness Status
                Section("Hardware & AlarmKit Status (P0)") {
                    HStack {
                        Label("Device Target", systemImage: "iphone")
                        Spacer()
                        Text("iPhone 12 (iOS 26+)")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Label("AlarmKit Framework", systemImage: "bell.badge.fill")
                        Spacer()
                        if alarmManager.isAuthorized {
                            Text("Authorized")
                                .foregroundColor(.green)
                                .fontWeight(.semibold)
                        } else {
                            Button("Request Permission") {
                                Task {
                                    _ = await alarmManager.requestAuthorization()
                                }
                            }
                            .foregroundColor(.blue)
                        }
                    }

                    HStack {
                        Label("Scheduled Alarms", systemImage: "alarm.fill")
                        Spacer()
                        Text("\(alarmManager.scheduledAlarmsCount) active")
                            .foregroundColor(.secondary)
                    }
                }

                // Section 2: Sync & Offline Status
                Section("Backend Synchronization") {
                    HStack {
                        Label("Sync State", systemImage: "arrow.triangle.2.circlepath")
                        Spacer()
                        if isSyncing {
                            ProgressView()
                        } else {
                            Text(syncStatusMessage)
                                .foregroundColor(.secondary)
                        }
                    }

                    Button(action: triggerManualSync) {
                        HStack {
                            Spacer()
                            Text("Sync Alarms Now")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(isSyncing)
                }

                // Section 3: Active Alarms / Demo Simulation
                Section("Active Alarms on Device") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Review Bab V Laporan KP")
                                .font(.headline)
                            Spacer()
                            Text("09:00 WIB")
                                .font(.subheadline)
                                .foregroundColor(.orange)
                        }
                        Text("AlarmKit prominent sound active (Overrides Silent & Focus)")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        HStack(spacing: 12) {
                            Button(action: {
                                _ = alarmManager.recordLocalSnooze(occurrenceId: "demo-occ-1", minutes: 10)
                                syncStatusMessage = "Snoozed 10m (Buffered)"
                            }) {
                                Label("Snooze 10m", systemImage: "clock.arrow.circlepath")
                                    .font(.caption)
                            }
                            .buttonStyle(.bordered)

                            Button(action: {
                                _ = alarmManager.recordLocalAcknowledgment(occurrenceId: "demo-occ-1")
                                syncStatusMessage = "Acknowledged (Buffered)"
                            }) {
                                Label("Acknowledge", systemImage: "checkmark.circle.fill")
                                    .font(.caption)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(.top, 4)
                    }
                    .padding(.vertical, 4)
                }

                // Section 4: Architecture Guarantee Notice
                Section {
                    Text("Conforms to docs/IOS_ALARM.md: Alarms run locally via AlarmKit. Acknowledgment & snooze survive network offline and reconcile with PostgreSQL upon reconnection.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("PAW Alarm")
        }
    }

    private func triggerManualSync() {
        isSyncing = true
        syncStatusMessage = "Syncing..."

        Task {
            // Flush any buffered offline actions first
            let buffered = alarmManager.getBufferedOfflineActions()
            if !buffered.isEmpty {
                let flushed = await DeviceSyncService.shared.flushOfflineActions(actions: buffered)
                alarmManager.clearBufferedActions(matchingIds: flushed)
            }

            // Reconcile desired alarms
            do {
                _ = try await DeviceSyncService.shared.enrollDevice()
                syncStatusMessage = "Synced at \(Date().formatted(date: .omitted, time: .shortened))"
            } catch {
                syncStatusMessage = "Offline (Local Alarms Preserved)"
            }
            isSyncing = false
        }
    }
}
