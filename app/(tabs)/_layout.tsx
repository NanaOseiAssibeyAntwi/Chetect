import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { layout, radius, type } from '@/constants/design';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.teal,
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
          height: layout.tabBarHeight + 2,
          paddingBottom: layout.tabBarPaddingBottom + 7,
          paddingTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="home-outline" size={19} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons color={color} name="file-document-outline" size={19} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="person-outline" size={18} />,
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
        name="change-password"
        options={{
          href: null,
          title: 'Change Password',
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
        name="session-history"
        options={{
          href: null,
          title: 'Session History',
        }}
      />
      <Tabs.Screen
        name="help-support"
        options={{
          href: null,
          title: 'Help & Support',
        }}
      />
    </Tabs>
  );
}
