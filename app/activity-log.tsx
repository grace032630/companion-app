import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchActivityLogPage, type TaskCompletion } from '../lib/activity';
import { useAuth } from '../lib/auth';

const PAGE_SIZE = 30;

function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(key: string) {
  const [year, month, day] = key.split('-');
  return `${year}/${Number(month)}/${Number(day)}`;
}

export default function ActivityLogScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<TaskCompletion[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = async (nextPage: number, append = false) => {
    const userId = session?.user.id;
    if (!userId) return;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const next = await fetchActivityLogPage(userId, nextPage, PAGE_SIZE);
      setItems((current) => append ? [...current, ...next] : next);
      setPage(nextPage);
      setHasMore(next.length === PAGE_SIZE);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  };

  useEffect(() => { void load(0); }, [session?.user.id]);

  const groups = useMemo(() => {
    const result: { key: string; items: TaskCompletion[] }[] = [];
    for (const item of items) {
      const key = dateKey(item.completed_at);
      const last = result[result.length - 1];
      if (!last || last.key !== key) result.push({ key, items: [item] });
      else last.items.push(item);
    }
    return result;
  }, [items]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <Text style={styles.title}>施工日誌</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#A86F4D" style={styles.loading} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>還沒有施工紀錄</Text></View>
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.dateTitle}>{dateLabel(group.key)}</Text>
                <View style={styles.card}>
                  {group.items.map((item) => (
                    <View key={item.id} style={styles.row}>
                      <View style={styles.dot} />
                      <View style={styles.copy}>
                        <Text style={styles.task}>{item.task}</Text>
                        <Text style={styles.time}>
                          {new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {hasMore && (
              <Pressable disabled={loadingMore} onPress={() => void load(page + 1, true)} style={styles.moreButton}>
                {loadingMore ? <ActivityIndicator color="#8A6450" /> : <Text style={styles.moreText}>載入更多</Text>}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{backgroundColor:'#FFF9F1',flex:1},
  header:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',paddingHorizontal:18,paddingTop:4},
  backButton:{alignItems:'center',height:44,justifyContent:'center',width:44},
  backText:{color:'#6C5648',fontSize:38,lineHeight:40},
  title:{color:'#493D34',fontSize:20,fontWeight:'900'},
  headerSpacer:{width:44},
  content:{paddingBottom:42,paddingHorizontal:20,paddingTop:12},
  loading:{marginTop:40},
  emptyCard:{alignItems:'center',backgroundColor:'#FFFFFF',borderColor:'#E9D9CD',borderRadius:22,borderWidth:1,padding:28},
  emptyText:{color:'#9C897B',fontSize:13},
  group:{marginBottom:20},
  dateTitle:{color:'#6B5548',fontSize:15,fontWeight:'900',marginBottom:8},
  card:{backgroundColor:'#FFFFFF',borderColor:'#E9D9CD',borderRadius:20,borderWidth:1,paddingHorizontal:16,paddingVertical:8},
  row:{alignItems:'center',flexDirection:'row',paddingVertical:10},
  dot:{backgroundColor:'#C78D69',borderRadius:5,height:10,marginRight:11,width:10},
  copy:{flex:1},
  task:{color:'#57463B',fontSize:14,fontWeight:'800'},
  time:{color:'#9A877A',fontSize:11,marginTop:3},
  moreButton:{alignItems:'center',backgroundColor:'#F3E3D7',borderRadius:15,justifyContent:'center',minHeight:48},
  moreText:{color:'#7C5D4B',fontSize:13,fontWeight:'800'},
});
