import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';

interface HotlineCategory {
  title: string;
  numbers: Array<{
    name: string;
    number: string;
    description?: string;
  }>;
}

const emergencyHotlines: HotlineCategory[] = [
  {
    title: "Hagonoy Emergency Numbers",
    numbers: [
      {
        name: "Hagonoy Rescue",
        number: "(044) 793-5811",
        description: "Local rescue services"
      },
      {
        name: "Hagonoy Rescue Mobile",
        number: "0925-885-5811",
        description: "Mobile emergency response"
      }
    ]
  },
  {
    title: "National Emergency Hotlines",
    numbers: [
      {
        name: "National Emergency Hotline",
        number: "911",
        description: "For any emergency situation"
      },
      {
        name: "PNP Hotline",
        number: "117",
        description: "Philippine National Police"
      },
      {
        name: "Red Cross Emergency",
        number: "143",
        description: "Emergency medical services"
      }
    ]
  },
  {
    title: "Government Agencies",
    numbers: [
      {
        name: "NDRRMC",
        number: "(02) 8911-5061",
        description: "National Disaster Risk Reduction and Management Council"
      },
      {
        name: "PAGASA",
        number: "(02) 8284-0800",
        description: "Weather updates and warnings"
      },
      {
        name: "BFP Command Center",
        number: "(02) 8426-0219",
        description: "Bureau of Fire Protection"
      },
      {
        name: "DOH COVID Hotline",
        number: "(02) 8651-7800",
        description: "Department of Health"
      }
    ]
  },
  {
    title: "Medical Emergency",
    numbers: [
      {
        name: "Philippine Coast Guard",
        number: "(02) 8527-8481",
        description: "Maritime emergency assistance"
      },
      {
        name: "Poison Control",
        number: "(02) 8524-1078",
        description: "National Poison Management Center"
      }
    ]
  }
];

const EmergencyHotlines = () => {
  const handleCall = (phoneNumber: string) => {
    const formattedNumber = phoneNumber.replace(/[^0-9+]/g, '');
    const dialNumber = Platform.select({
      ios: `telprompt:${formattedNumber}`,
      android: `tel:${formattedNumber}`
    });

    if (dialNumber) {
      Linking.openURL(dialNumber).catch(err => {
        console.error('Error opening dial pad:', err);
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency Hotlines</Text>
        <Text style={styles.headerSubtitle}>Tap on any number to call</Text>
      </View>

      {emergencyHotlines.map((category, index) => (
        <View key={index} style={styles.categoryContainer}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          {category.numbers.map((item, itemIndex) => (
            <TouchableOpacity
              key={itemIndex}
              style={styles.hotlineItem}
              onPress={() => handleCall(item.number)}
            >
              <View>
                <Text style={styles.hotlineName}>{item.name}</Text>
                {item.description && (
                  <Text style={styles.hotlineDescription}>{item.description}</Text>
                )}
              </View>
              <Text style={styles.hotlineNumber}>{item.number}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          In case of emergency, please contact the nearest emergency hotline.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#e74c3c',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  categoryContainer: {
    marginVertical: 10,
    paddingHorizontal: 15,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginVertical: 10,
  },
  hotlineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  hotlineName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  hotlineDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  hotlineNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: '#e74c3c',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 12,
  },
});

export default EmergencyHotlines;
