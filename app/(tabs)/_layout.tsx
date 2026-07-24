import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { layout, palette, type } from '@/constants/design';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.teal,
        tabBarButton: HapticTab,
        tabBarInactiveTintColor: palette.muted,
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
          backgroundColor: palette.panel,
          borderTopColor: palette.border,
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
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons color={color} name="file-document-outline" size={19} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color }) => <Ionicons color={color} name="person-outline" size={18} />,
        }}
      />
    </Tabs>
  );
}
