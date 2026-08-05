import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function InvigilatorTabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.warning,
        tabBarButton: HapticTab,
        tabBarInactiveTintColor: colors.muted,
        tabBarItemStyle: {
          paddingBottom: 5,
          paddingTop: 0,
        },
        tabBarLabelStyle: {
          fontSize: type.tiny,
          fontWeight: '700',
          letterSpacing: 0.4,
          marginTop: 0,
        },
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderTopWidth: 1,
          height: layout.tabBarHeight + 4,
          paddingBottom: layout.tabBarPaddingBottom + 7,
          paddingTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dash',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons color={color} name="view-grid-outline" size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="monitor"
        options={{
          title: 'Monitor',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons color={color} name="monitor" size={18} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="add" size={18} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons color={color} name="file-document-outline" size={18} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather color={color} name="user" size={17} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Notifications',
        }}
      />
      <Tabs.Screen
        name="access-role"
        options={{
          href: null,
          title: 'Access Role',
        }}
      />
      <Tabs.Screen
        name="audit-history"
        options={{
          href: null,
          title: 'Audit History',
        }}
      />
      <Tabs.Screen
        name="help-support"
        options={{
          href: null,
          title: 'Help & Support',
        }}
      />
      <Tabs.Screen
        name="session-details"
        options={{
          href: null,
          title: 'Session Details',
        }}
      />
      <Tabs.Screen
        name="report-details"
        options={{
          href: null,
          title: 'Report Details',
        }}
      />
    </Tabs>
  );
}
