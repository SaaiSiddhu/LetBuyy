import type { RuntimeCorrelationContext } from './event-envelope-runtime';
import type { RuntimeControlCommand } from './operations-runtime';
import type { ExecutionTokenClaims, RuntimePermission } from './security-runtime';
import { assertRuntimePermission } from './security-runtime';

export interface OperationalControlPlaneCommand extends RuntimeControlCommand {
  status: 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: Record<string, unknown>;
}

export interface OperationalControlPlanePort {
  submit(command: OperationalControlPlaneCommand, context: RuntimeCorrelationContext): Promise<void>;
  load(commandId: string): Promise<OperationalControlPlaneCommand | null>;
  transition(commandId: string, status: OperationalControlPlaneCommand['status'], result?: Record<string, unknown>): Promise<void>;
}

export function permissionForControlCommand(command: RuntimeControlCommand): RuntimePermission {
  if (command.targetType === 'queue' || command.targetType === 'dead-letter') {
    return {
      resourceType: 'queue',
      action: command.operation === 'redrive-dead-letter' ? 'redrive' : 'admin',
      tenantScoped: false,
    };
  }

  if (command.targetType === 'event-stream') {
    return {
      resourceType: 'event-stream',
      action: 'replay',
      tenantScoped: false,
    };
  }

  if (command.targetType === 'workflow') {
    return {
      resourceType: 'workflow',
      action: command.operation === 'cancel-workflow' ? 'cancel' : 'admin',
      tenantScoped: false,
    };
  }

  return {
    resourceType: 'tenant-runtime',
    action: 'admin',
    tenantScoped: false,
  };
}

export class OperationalControlPlaneRuntime {
  constructor(private readonly controlPlane: OperationalControlPlanePort) {}

  async submit(command: RuntimeControlCommand, claims: ExecutionTokenClaims, context: RuntimeCorrelationContext): Promise<OperationalControlPlaneCommand> {
    assertRuntimePermission(claims, permissionForControlCommand(command));
    const accepted: OperationalControlPlaneCommand = {
      ...command,
      status: 'accepted',
    };
    await this.controlPlane.submit(accepted, context);
    return accepted;
  }

  load(commandId: string): Promise<OperationalControlPlaneCommand | null> {
    return this.controlPlane.load(commandId);
  }

  transition(commandId: string, status: OperationalControlPlaneCommand['status'], result?: Record<string, unknown>): Promise<void> {
    return this.controlPlane.transition(commandId, status, result);
  }
}
