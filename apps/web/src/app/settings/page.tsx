'use client';

import React, { useState } from 'react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import { apiRequest, devicesApi } from '@/lib/api';
import {
  ResourceNotice,
  readList,
  secondaryButton,
  useResource,
} from '@/components/shared/ResourceState';
import { readAccount, useAccount } from '@/components/shared/SessionContext';
import { BrowserEnrollment } from '@/components/shared/BrowserEnrollment';
import { AccountSecurity } from '@/components/shared/AccountSecurity';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { displayDate } from '@/components/shared/agenda';
import { ConnectionGuidance } from './ConnectionGuidance';
import { IntegrationCards } from '@/components/integrations/IntegrationCards';

interface Device {
  id: string;
  platform: string;
  deviceName: string | null;
  registeredAt: string;
  lastSeenAt: string;
}
const loadDevices = async () => readList<Device>(await devicesApi.list());
const loadAccount = async () => readAccount(await apiRequest('/me'));

export default function SettingsPage() {
  const sessionAccount = useAccount();
  const account = useResource(loadAccount);
  const devices = useResource(loadDevices);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const timezone =
    account.state.status === 'success'
      ? account.state.data.timezone
      : (sessionAccount?.timezone ?? 'Asia/Jakarta');
  const rows = devices.state.status === 'success' ? devices.state.data : [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const columns: DataTableColumn<Device>[] = [
    {
      key: 'name',
      header: 'Device',
      render: (device) => (
        <div>
          <p className="font-medium">{device.deviceName || 'Unnamed device'}</p>
          <p className="mt-1 break-all text-xs text-text-secondary">{device.id}</p>
        </div>
      ),
    },
    { key: 'platform', header: 'Platform', render: (device) => device.platform },
    {
      key: 'seen',
      header: 'Last reported',
      render: (device) => (
        <time dateTime={device.lastSeenAt}>{displayDate(device.lastSeenAt, timezone)}</time>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Account details, appearance, and registered devices.
        </p>
      </div>

      <section
        id="account"
        aria-labelledby="account-title"
        className="scroll-mt-24 rounded-xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="account-title" className="text-base font-semibold">
            Your account
          </h2>
          <button
            type="button"
            onClick={account.retry}
            disabled={account.state.status === 'loading'}
            className={secondaryButton}
          >
            Refresh account
          </button>
        </div>
        {account.state.status !== 'success' ? (
          <ResourceNotice
            status={account.state.status}
            noun="account details"
            onRetry={account.retry}
          />
        ) : (
          <dl className="divide-y divide-border text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-text-secondary">Email</dt>
              <dd className="break-all font-medium">{account.state.data.email}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-text-secondary">Timezone</dt>
              <dd>{account.state.data.timezone}</dd>
            </div>
          </dl>
        )}
      </section>

      <AccountSecurity onProfileUpdated={account.retry} />

      <ThemeSwitcher />

      <section
        aria-labelledby="devices-title"
        className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="devices-title" className="text-base font-semibold">
              Registered devices
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Registration is not proof of notification delivery or native alarm authorization.
            </p>
          </div>
          <button
            type="button"
            onClick={devices.retry}
            disabled={devices.state.status === 'loading'}
            className={secondaryButton}
          >
            Refresh devices
          </button>
        </div>
        <BrowserEnrollment
          onRegistered={() => {
            setPage(1);
            devices.retry();
          }}
        />
        <DataTable
          caption="Registered devices"
          rows={rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          columns={columns}
          getRowId={(device) => device.id}
          loading={devices.state.status === 'loading'}
          error={
            devices.state.status === 'error'
              ? 'Could not load devices. The registration count is unavailable.'
              : null
          }
          onRetry={devices.retry}
          emptyMessage="No devices registered. Use Connect Browser to register this browser explicitly."
          pagination={{
            page: currentPage,
            pageSize,
            totalItems: rows.length,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
        />
        <p className="text-xs text-text-secondary">
          Times shown in {timezone}. iOS alarm capability must be confirmed on the physical device;
          this list cannot verify it.
        </p>
      </section>

      <IntegrationCards />

      <ConnectionGuidance />

      <section
        aria-labelledby="backup-title"
        className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 id="backup-title" className="text-base font-semibold">
              Backup and recovery
            </h2>
            <p id="backup-reason" className="mt-2 text-sm leading-relaxed text-text-secondary">
              Backup export is unavailable: this UI has no verified database backup endpoint or
              restore evidence. A settings JSON file is not a database backup. Use the
              operator-managed backup and tested restore procedure.
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-describedby="backup-reason"
            className={secondaryButton}
          >
            Export backup unavailable
          </button>
        </div>
      </section>
    </div>
  );
}
