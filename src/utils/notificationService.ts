import { Customer, Invoice, Quotation, Shipment, TrackingUpdate } from '../types';

export interface AppNotification {
  id: string;
  type: 'INVOICE' | 'SHIPMENT' | 'QUOTATION' | 'PAYMENT' | 'CLAIM';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority?: 'high' | 'normal';
  linkTab?: 'TRACKING' | 'INVOICES' | 'WARRANTY' | 'LEDGER' | 'QUOTES';
  referenceId?: string;
  pdfAvailable?: boolean;
}

/**
 * Checks current browser push notification permission status
 */
export const getBrowserNotificationPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Requests browser push notification permission
 */
export const requestBrowserNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Notification permission request error', err);
    return false;
  }
};

/**
 * Sends a native browser push notification if granted
 */
export const sendBrowserPushNotification = (
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    data?: any;
  }
) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: options?.body || 'New update from Lakhi Airconditioners',
        icon: options?.icon || '/1x1-logo.png',
        tag: options?.tag,
        badge: '/1x1-logo.png',
      });
    } catch (e) {
      console.warn('Failed to dispatch browser notification', e);
    }
  }
};

/**
 * Generates an aggregated chronological notification log for a customer from their
 * real invoices, shipments, quotations, and tracking updates.
 */
export const generateCustomerNotifications = (
  customer: Customer,
  invoices: Invoice[],
  shipments: Shipment[],
  quotations: Quotation[],
  readIds: Set<string>
): AppNotification[] => {
  const notifications: AppNotification[] = [];

  // 1. Invoices for this customer
  const custInvoices = invoices.filter((i) => i.customerId === customer.id);
  custInvoices.forEach((inv) => {
    const notifId = `inv-${inv.id}`;
    const amountStr = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(inv.totalAmount);

    const dueStr = inv.amountDue > 0
      ? ` • Pending balance: ₹${inv.amountDue.toLocaleString('en-IN')}`
      : ' • Paid in full';

    notifications.push({
      id: notifId,
      type: 'INVOICE',
      title: `Invoice Added: ${inv.id}`,
      message: `Tax Invoice of ${amountStr} generated for ${inv.items?.length || 1} item(s)${dueStr}.`,
      timestamp: inv.createdAt,
      isRead: readIds.has(notifId),
      linkTab: 'INVOICES',
      referenceId: inv.id,
      pdfAvailable: true,
      priority: inv.amountDue > 0 ? 'high' : 'normal',
    });
  });

  // 2. Shipments and tracking updates for this customer
  const custShipments = shipments.filter(
    (s) => s.customerId === customer.id || (s.customerPhone && s.customerPhone.includes(customer.phone.slice(-8)))
  );

  custShipments.forEach((ship) => {
    const notifId = `ship-${ship.id}`;
    const statusMap: Record<Shipment['status'], string> = {
      ORDER_PLACED: 'Order Placed in Lakhi System',
      ORDER_CONFIRMED: 'Order Confirmed - Stock Reserved',
      IN_TRANSIT: 'In Transit to Store',
      ARRIVED_AT_STORE: 'Arrived at Store Premises',
      OUT_FOR_DELIVERY: `Out for Delivery${ship.driverName ? ` with Driver ${ship.driverName}` : ''}`,
      DELIVERED_INSTALLED: 'Delivered & Installed at Your Site',
    };

    const statusTitle = statusMap[ship.status] || ship.status;

    notifications.push({
      id: notifId,
      type: 'SHIPMENT',
      title: `Delivery Update: ${statusTitle}`,
      message: `Shipment #${ship.id}: ${ship.itemsSummary || 'Air conditioning unit'}. Destination: ${ship.deliveryAddress}.`,
      timestamp: ship.updatedAt || ship.createdAt,
      isRead: readIds.has(notifId),
      linkTab: 'TRACKING',
      referenceId: ship.id,
      priority: ship.status === 'OUT_FOR_DELIVERY' || ship.status === 'DELIVERED_INSTALLED' ? 'high' : 'normal',
    });

    // Detailed tracking step updates
    if (ship.trackingUpdates && ship.trackingUpdates.length > 1) {
      ship.trackingUpdates.slice(1).forEach((update, idx) => {
        const updateNotifId = `trk-${ship.id}-${idx}`;
        notifications.push({
          id: updateNotifId,
          type: 'SHIPMENT',
          title: `Order Tracking Update (#${ship.id})`,
          message: update.message,
          timestamp: update.timestamp,
          isRead: readIds.has(updateNotifId),
          linkTab: 'TRACKING',
          referenceId: ship.id,
        });
      });
    }
  });

  // 3. Quotations for this customer
  const custQuotes = quotations.filter((q) => q.customerId === customer.id);
  custQuotes.forEach((quote) => {
    const notifId = `quote-${quote.id}`;
    const amountStr = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(quote.totalAmount);

    notifications.push({
      id: notifId,
      type: 'QUOTATION',
      title: `Quotation Prepared: ${quote.id}`,
      message: `A quotation of ${amountStr} was prepared for your inquiry (${quote.items?.length || 1} item(s)).`,
      timestamp: quote.createdAt,
      isRead: readIds.has(notifId),
      linkTab: 'QUOTES',
      referenceId: quote.id,
      pdfAvailable: true,
    });
  });

  // Sort descending by timestamp
  return notifications.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};
