import { Injectable, BadRequestException } from '@nestjs/common';
import { ApprovalsService, ProposedActionPayload } from '../approvals/approvals.service';

@Injectable()
export class AiService {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /**
   * Natural Language Intent Parser & Structured Action Proposer (docs/AI_APPROVAL_AND_AGENTS.md)
   * Converts user natural language into an immutable approval request.
   * STRICT SAFETY RULE: AI assistant NEVER directly commits side effects.
   */
  async proposeAction(
    ownerId: string,
    naturalLanguagePrompt: string,
    traceId?: string,
  ): Promise<{
    status: string;
    message: string;
    proposal: unknown;
    summary: string;
    riskLevel: string;
  }> {
    if (!naturalLanguagePrompt || naturalLanguagePrompt.trim() === '') {
      throw new BadRequestException('Prompt is required');
    }

    const text = naturalLanguagePrompt.toLowerCase();
    let proposedAction: ProposedActionPayload;

    // 1. Detect Meeting Creation Intent (Google Meet / Zoom)
    if (
      text.includes('meet') ||
      text.includes('zoom') ||
      text.includes('rapat') ||
      text.includes('diskusi')
    ) {
      const provider = text.includes('zoom') ? 'zoom' : 'google-meet';
      const title =
        this.extractTitle(naturalLanguagePrompt, [
          'jadwalkan',
          'meeting',
          'zoom',
          'google meet',
          'rapat',
        ]) || 'Scheduled Video Meeting';

      const tomorrow9am = new Date();
      tomorrow9am.setDate(tomorrow9am.getDate() + 1);
      tomorrow9am.setHours(9, 0, 0, 0);
      const tomorrow10am = new Date(tomorrow9am.getTime() + 3600000);

      proposedAction = {
        action: 'meeting.create',
        parameters: {
          provider,
          title,
          startsAt: tomorrow9am.toISOString(),
          endsAt: tomorrow10am.toISOString(),
          timezone: 'Asia/Jakarta',
        },
        riskLevel: 'medium',
        humanSummary: `Provision ${provider === 'zoom' ? 'Zoom Meeting' : 'Google Meet'}: "${title}" at ${tomorrow9am.toLocaleDateString('id-ID')} 09:00 WIB`,
      };
    }
    // 2. Detect Calendar Event Intent
    else if (text.includes('agenda') || text.includes('kalender') || text.includes('jadwal')) {
      const title =
        this.extractTitle(naturalLanguagePrompt, ['tambah', 'agenda', 'jadwal', 'ke kalender']) ||
        'Calendar Agenda';
      const startsAt = new Date(Date.now() + 86400000);
      startsAt.setHours(10, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + 3600000);

      proposedAction = {
        action: 'calendar.event.create',
        parameters: {
          title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: 'Asia/Jakarta',
        },
        riskLevel: 'low',
        humanSummary: `Add Calendar Event: "${title}" on ${startsAt.toLocaleDateString('id-ID')}`,
      };
    }
    // 3. Detect Task Creation Intent (Default)
    else {
      const title =
        this.extractTitle(naturalLanguagePrompt, ['buat task', 'tugas', 'revisi', 'kerjakan']) ||
        naturalLanguagePrompt.trim();
      const priority =
        text.includes('urgent') || text.includes('penting')
          ? 'urgent'
          : text.includes('tinggi')
            ? 'high'
            : 'normal';

      proposedAction = {
        action: 'task.create',
        parameters: {
          title,
          priority,
          dueAt: new Date(Date.now() + 86400000 * 2).toISOString(),
          timezone: 'Asia/Jakarta',
          tags: ['ai-proposed'],
        },
        riskLevel: 'low',
        humanSummary: `Create Task [${priority.toUpperCase()}]: "${title}"`,
      };
    }

    // Submit proposal to Approval Gateway
    const proposal = await this.approvalsService.createApprovalRequest(
      ownerId,
      proposedAction,
      'backend-ai-assistant',
      24,
      traceId,
    );

    return {
      status: 'pending_approval',
      message: 'AI Assistant created an action proposal. Owner approval required before execution.',
      proposal: proposal.data,
      summary: proposedAction.humanSummary,
      riskLevel: proposedAction.riskLevel,
    };
  }

  private extractTitle(prompt: string, prefixes: string[]): string {
    let clean = prompt.trim();
    for (const prefix of prefixes) {
      const regex = new RegExp(`^${prefix}\\s*`, 'i');
      clean = clean.replace(regex, '');
    }
    return clean.replace(/^(tentang|mengenai)\s+/i, '').trim();
  }
}
