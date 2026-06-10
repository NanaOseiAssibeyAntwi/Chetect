import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { palette, type } from '@/constants/design';

export default function InvigilatorTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.warning,
        tabBarButton: HapticTab,
        tabBarInactiveTintColor: '#6b7f9c',
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: type.tiny,
          fontWeight: '700',
          letterSpacing: 1.3,
          marginTop: 2,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
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
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color }) => <MaterialCommunityIcons color={color} name="monitor" size={18} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarStyle: { display: 'none' },
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
    </Tabs>
  );
}
