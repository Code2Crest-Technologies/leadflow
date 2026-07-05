export interface INotificationService {
  broadcastToCompany(companyId: string, event: string, payload: unknown): void;
}
