import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimalCharacter } from '../components/AnimalCharacter';
import { ANIMAL_OPTIONS } from '../constants/crew';
import { parseRoomReturnTo } from '../lib/deep-link';
import { useProfile } from '../lib/profile';

export default function ProfileSetupScreen() {
  const { profile, saveProfile } = useProfile();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [animal, setAnimal] = useState<string>(profile?.animal ?? ANIMAL_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    const cleaned = nickname.trim();
    if (!cleaned) {
      setErrorMessage('先幫自己取一個名字吧');
      return;
    }
    if (cleaned.length > 16) {
      setErrorMessage('暱稱最多 16 個字');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    const result = await saveProfile({ nickname: cleaned, animal });
    setSaving(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    router.replace(parseRoomReturnTo(params.returnTo) ?? '/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>建立你的角色</Text>
          <Text style={styles.title}>以後大家看到的就是這隻你</Text>
          <Text style={styles.subtitle}>選一隻喜歡的動物 再取個暱稱</Text>

          <View style={styles.previewCard}>
            <AnimalCharacter animal={animal} size="large" state="idle" />
            <Text style={styles.previewName}>{nickname.trim() || '你的名字'}</Text>
          </View>

          <Text style={styles.sectionTitle}>選角色</Text>
          <View style={styles.animalGrid}>
            {ANIMAL_OPTIONS.map((item) => {
              const selected = animal === item;
              return (
                <Pressable
                  key={item}
                  accessibilityLabel={`選擇角色 ${item}`}
                  onPress={() => setAnimal(item)}
                  style={({ pressed }) => [styles.animalButton, selected && styles.animalSelected, pressed && styles.pressed]}>
                  <AnimalCharacter animal={item} size="regular" state="idle" />
                  {selected && <Text style={styles.selectedMark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>暱稱</Text>
          <TextInput
            autoCapitalize="none"
            maxLength={16}
            onChangeText={setNickname}
            placeholder="例如 麻糬"
            placeholderTextColor="#B2A094"
            returnKeyType="done"
            style={styles.input}
            value={nickname}
          />
          <Text style={styles.counter}>{nickname.length}/16</Text>

          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

          <Pressable
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && !saving && styles.pressed]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>就決定是你了</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9F1', flex: 1 },
  flex: { flex: 1 },
  content: { paddingBottom: 38, paddingHorizontal: 24, paddingTop: 30 },
  eyebrow: { color: '#9A755D', fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#493D34', fontSize: 29, fontWeight: '900', lineHeight: 39, marginTop: 8 },
  subtitle: { color: '#8D7869', fontSize: 15, lineHeight: 22, marginTop: 8 },
  previewCard: {
    alignItems: 'center',
    backgroundColor: '#F3E1D3',
    borderColor: '#E4C8B4',
    borderRadius: 30,
    borderWidth: 1,
    marginTop: 28,
    paddingVertical: 26,
  },
  previewName: { color: '#5D493C', fontSize: 20, fontWeight: '900', marginTop: 8 },
  sectionTitle: { color: '#5D493C', fontSize: 15, fontWeight: '900', marginBottom: 12, marginTop: 28 },
  animalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  animalButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E9D9CC',
    borderRadius: 20,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    position: 'relative',
    width: '22%',
  },
  animalSelected: { backgroundColor: '#F5DDD0', borderColor: '#B97855', borderWidth: 2 },
  selectedMark: {
    backgroundColor: '#A86F4D',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    height: 20,
    lineHeight: 20,
    position: 'absolute',
    right: 6,
    textAlign: 'center',
    top: 6,
    width: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3CFC0',
    borderRadius: 18,
    borderWidth: 1,
    color: '#493D34',
    fontSize: 18,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  counter: { color: '#A69487', fontSize: 11, marginTop: 7, textAlign: 'right' },
  error: { color: '#A04F3B', fontSize: 13, marginTop: 12, textAlign: 'center' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#A86F4D',
    borderRadius: 20,
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 60,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.74 },
});
