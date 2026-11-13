import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.whiskm.subscriptionpayments',
  appName: 'Subscription Payments',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_ticket', iconColor: '#E4572E' },
  },
};

export default config;
