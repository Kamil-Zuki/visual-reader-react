/**
 * ddiaConceptGraph.js
 * 
 * Curated LightRAG Semantic Knowledge Graph for "Designing Data-Intensive Applications" (Martin Kleppmann).
 * Contains domain concepts, definitions, chapter references, and directed architectural relationships.
 */

export const CONCEPT_CATEGORIES = {
  storage: { label: 'Хранилища и Индексы', color: '#38bdf8' },
  replication: { label: 'Репликация и Консенсус', color: '#a855f7' },
  transactions: { label: 'Транзакции и Concurrency', color: '#f59e0b' },
  distributed: { label: 'Распределённые системы', color: '#10b981' },
  processing: { label: 'Пакетная и Потоковая обработка', color: '#ec4899' },
  models: { label: 'Модели данных и Схемы', color: '#818cf8' },
};

export const INITIAL_DDIA_CONCEPTS = [
  // --- Storage & Indexes (Chapter 3) ---
  {
    id: 'lsm_tree',
    name: 'LSM-Tree',
    category: 'storage',
    val: 18,
    summary: 'Структура хранения на основе сортированных строк в памяти (MemTable) с периодическим сбросом в иммутабельные файлы на диске (SSTables). Оптимизирована под быструю запись.',
    chapters: [{ cIdx: 2, sIdx: 0, title: 'Глава 3: Хранение и извлечение данных' }]
  },
  {
    id: 'sstable',
    name: 'SSTable (Sorted String Table)',
    category: 'storage',
    val: 14,
    summary: 'Иммутабельный дисковый файл с отсортированными по ключу парами ключ-значение. Основа LSM-деревьев.',
    chapters: [{ cIdx: 2, sIdx: 1, title: 'Глава 3: SSTables и LSM-деревья' }]
  },
  {
    id: 'b_tree',
    name: 'B-Tree',
    category: 'storage',
    val: 17,
    summary: 'Классическая иерархическая структура страниц фиксированного размера (обычно 4 КБ), обновляемая in-place. Стандарт большинства реляционных СУБД.',
    chapters: [{ cIdx: 2, sIdx: 2, title: 'Глава 3: B-деревья' }]
  },
  {
    id: 'wal',
    name: 'WAL (Write-Ahead Log)',
    category: 'storage',
    val: 15,
    summary: 'Журнал упреждающей записи на диск (append-only) для восстановления состояния памяти при сбоях (crash recovery).',
    chapters: [{ cIdx: 2, sIdx: 2, title: 'Глава 3: Надежность B-деревьев и WAL' }]
  },
  {
    id: 'bloom_filter',
    name: 'Bloom Filter',
    category: 'storage',
    val: 12,
    summary: 'Вероятностная структура данных для быстрой проверки отсутствия ключа на диске, предотвращающая лишние операции I/O.',
    chapters: [{ cIdx: 2, sIdx: 1, title: 'Глава 3: Оптимизация LSM-деревьев' }]
  },
  {
    id: 'compaction',
    name: 'Compaction (Уплотнение)',
    category: 'storage',
    val: 13,
    summary: 'Фоновый процесс слияния нескольких SSTables с удалением дубликатов и устаревших версий (tombstones).',
    chapters: [{ cIdx: 2, sIdx: 1, title: 'Глава 3: Уплотнение SSTables' }]
  },
  {
    id: 'column_storage',
    name: 'Колоночное хранилище',
    category: 'storage',
    val: 14,
    summary: 'Организация данных по колонкам (Parquet, ClickHouse) для эффективной компрессии и быстрых аналитических запросов (OLAP).',
    chapters: [{ cIdx: 2, sIdx: 3, title: 'Глава 3: Аналитика и колоночные базы' }]
  },

  // --- Replication & Consensus (Chapters 5, 9) ---
  {
    id: 'single_leader',
    name: 'Single-Leader Replication',
    category: 'replication',
    val: 16,
    summary: 'Архитектура с одним лидером для записи и репликами для чтения. Лидер транслирует поток изменений последователям.',
    chapters: [{ cIdx: 4, sIdx: 0, title: 'Глава 5: Репликация с одним лидером' }]
  },
  {
    id: 'multi_leader',
    name: 'Multi-Leader Replication',
    category: 'replication',
    val: 14,
    summary: 'Запись разрешена в нескольких датацентрах одновременно. Требует механизмов разрешения конфликтов concurrent-записей.',
    chapters: [{ cIdx: 4, sIdx: 1, title: 'Глава 5: Multi-Leader репликация' }]
  },
  {
    id: 'leaderless',
    name: 'Leaderless (Dynamo-style)',
    category: 'replication',
    val: 15,
    summary: 'Безлидерная модель (Cassandra, Dynamo): клиент отправляет запись и чтение параллельно нескольким узлам.',
    chapters: [{ cIdx: 4, sIdx: 2, title: 'Глава 5: Безлидерная репликация' }]
  },
  {
    id: 'quorum',
    name: 'Quorum (Кворум W + R > N)',
    category: 'replication',
    val: 15,
    summary: 'Правило пересечения кворумов: если число подтверждений записи W и чтения R превышает число реплик N, чтение гарантированно видит свежее значение.',
    chapters: [{ cIdx: 4, sIdx: 2, title: 'Глава 5: Кворумы для чтения и записи' }]
  },
  {
    id: 'split_brain',
    name: 'Split-Brain (Расщепление мозга)',
    category: 'replication',
    val: 14,
    summary: 'Опасная ситуация, когда два узла в сети одновременно считают себя активными лидерами из-за сбоя связи, повреждая данные.',
    chapters: [{ cIdx: 4, sIdx: 0, title: 'Глава 5: Сбои репликации и failover' }]
  },
  {
    id: 'consensus_raft_paxos',
    name: 'Алгоритмы Консенсуса (Raft/Paxos)',
    category: 'replication',
    val: 19,
    summary: 'Протоколы согласования единого решения распределёнными узлами в условиях ненадежной сети и сбоев части узлов.',
    chapters: [{ cIdx: 8, sIdx: 2, title: 'Глава 9: Распределённый консенсус' }]
  },
  {
    id: 'fencing_token',
    name: 'Fencing Token (Ограждающий токен)',
    category: 'replication',
    val: 13,
    summary: 'Монотонно возрастающее число, выдаваемое координатором блокировок для защиты от запоздавших запросов («зомби»-узлов).',
    chapters: [{ cIdx: 7, sIdx: 1, title: 'Глава 8: Проблемы синхронизации и блокировки' }]
  },
  {
    id: 'vector_clocks',
    name: 'Векторные часы (Vector Clocks)',
    category: 'replication',
    val: 13,
    summary: 'Механизм отслеживания причинно-следственной связи (happens-before) между параллельными событиями в распределенной системе.',
    chapters: [{ cIdx: 4, sIdx: 2, title: 'Глава 5: Разрешение конфликтов и векторные часы' }]
  },

  // --- Transactions & Concurrency (Chapter 7) ---
  {
    id: 'acid',
    name: 'ACID Гарантии',
    category: 'transactions',
    val: 17,
    summary: 'Атомарность, Согласованность, Изолированность, Надежность — фундамент транзакционных баз данных.',
    chapters: [{ cIdx: 6, sIdx: 0, title: 'Глава 7: Значение ACID' }]
  },
  {
    id: 'serializability',
    name: 'Сериализуемость (Serializability)',
    category: 'transactions',
    val: 16,
    summary: 'Строжайший уровень изоляции транзакций: гарантирует, что результат параллельного исполнения идентичен некоторому последовательному.',
    chapters: [{ cIdx: 6, sIdx: 2, title: 'Глава 7: Сериализуемость и SSI' }]
  },
  {
    id: 'snapshot_isolation',
    name: 'Snapshot Isolation & MVCC',
    category: 'transactions',
    val: 16,
    summary: 'Транзакция видит консистентный снимок БД на момент своего старта. Читатели не блокируют писателей, а писатели — читателей.',
    chapters: [{ cIdx: 6, sIdx: 1, title: 'Глава 7: Изоляция снимков и MVCC' }]
  },
  {
    id: 'two_phase_commit',
    name: '2PC (Two-Phase Commit)',
    category: 'transactions',
    val: 15,
    summary: 'Протокол двухфазной фиксации атомарной транзакции на нескольких узлах через координатора. Уязвим к блокировке при падении координатора.',
    chapters: [{ cIdx: 8, sIdx: 1, title: 'Глава 9: Атомарный коммит и 2PC' }]
  },
  {
    id: 'phantom_read',
    name: 'Фантомные чтения и Write Skew',
    category: 'transactions',
    val: 13,
    summary: 'Аномалия конкурентности, возникающая когда транзакция читает набор строк, а параллельная транзакция меняет состав этого набора.',
    chapters: [{ cIdx: 6, sIdx: 1, title: 'Глава 7: Предотвращение Write Skew' }]
  },

  // --- Distributed Systems & Consistency (Chapters 8, 9) ---
  {
    id: 'linearizability',
    name: 'Линеаризуемость (Linearizability)',
    category: 'distributed',
    val: 17,
    summary: 'Гарантия свежести (recency guarantee): система ведет себя так, словно существует всего одна копия данных и все операции мгновенны.',
    chapters: [{ cIdx: 8, sIdx: 0, title: 'Глава 9: Линеаризуемость' }]
  },
  {
    id: 'eventual_consistency',
    name: 'Eventual Consistency (Согласованность в конечном счёте)',
    category: 'distributed',
    val: 15,
    summary: 'Слабая гарантия согласованности: при отсутствии новых записей все реплики в итоге придут к одинаковому состоянию.',
    chapters: [{ cIdx: 4, sIdx: 1, title: 'Глава 5: Проблемы задержки репликации' }]
  },
  {
    id: 'cap_theorem',
    name: 'Теорема CAP',
    category: 'distributed',
    val: 16,
    summary: 'При сетевом разделении (Network Partition) распределенная система обязана выбирать между Согласованностью (CP) или Доступностью (AP).',
    chapters: [{ cIdx: 8, sIdx: 0, title: 'Глава 9: CAP-теорема на практике' }]
  },
  {
    id: 'clock_skew',
    name: 'Смещение часов (Clock Skew)',
    category: 'distributed',
    val: 13,
    summary: 'Ненадежность физических кварцевых часов в сети серверов, делающая сортировку событий по wall-clock time опасной (LWW).',
    chapters: [{ cIdx: 7, sIdx: 0, title: 'Глава 8: Ненадежные часы' }]
  },
  {
    id: 'partitioning',
    name: 'Партиционирование (Sharding)',
    category: 'distributed',
    val: 16,
    summary: 'Разделение большого набора данных на независимые фрагменты по диапазонам ключей или хешу для масштабирования.',
    chapters: [{ cIdx: 5, sIdx: 0, title: 'Глава 6: Партиционирование данных' }]
  },

  // --- Processing & Integration (Chapters 10, 11) ---
  {
    id: 'batch_processing',
    name: 'Пакетная обработка (MapReduce)',
    category: 'processing',
    val: 15,
    summary: 'Обработка больших неизменяемых массивов накопленных данных с детерминированными шагами Map и Reduce.',
    chapters: [{ cIdx: 9, sIdx: 0, title: 'Глава 10: Пакетная обработка данных' }]
  },
  {
    id: 'stream_processing',
    name: 'Потоковая обработка (Stream Processing)',
    category: 'processing',
    val: 16,
    summary: 'Непрерывная обработка бесконечных потоков событий в реальном времени с низкими задержками (Kafka, Flink).',
    chapters: [{ cIdx: 10, sIdx: 0, title: 'Глава 11: Потоковая обработка' }]
  },
  {
    id: 'change_data_capture',
    name: 'Change Data Capture (CDC)',
    category: 'processing',
    val: 15,
    summary: 'Извлечение лога изменений из базы данных для передачи в реальном времени в поисковые индексы, кэши или хранилища.',
    chapters: [{ cIdx: 10, sIdx: 1, title: 'Глава 11: Базы данных и потоки' }]
  },
  {
    id: 'event_sourcing',
    name: 'Event Sourcing (Событийное порождение)',
    category: 'processing',
    val: 14,
    summary: 'Паттерн сохранения всех изменений состояния как последовательности неизменяемых событий, а не просто текущего состояния.',
    chapters: [{ cIdx: 10, sIdx: 1, title: 'Глава 11: Паттерн Event Sourcing' }]
  },

  // --- Models & Schemas (Chapters 2, 4) ---
  {
    id: 'schema_evolution',
    name: 'Эволюция схем (Avro/Protobuf)',
    category: 'models',
    val: 14,
    summary: 'Поддержка обратной и прямой совместимости при изменении полей данных без прерывания работы систем.',
    chapters: [{ cIdx: 3, sIdx: 0, title: 'Глава 4: Кодирование и эволюция схем' }]
  },
  {
    id: 'relational_vs_document',
    name: 'Реляционная vs Документная модель',
    category: 'models',
    val: 15,
    summary: 'Сравнение парадигм: сильные связи many-to-many и нормализация против локальности данных и древовидных структур.',
    chapters: [{ cIdx: 1, sIdx: 0, title: 'Глава 2: Модели данных и языки запросов' }]
  },
];

export const INITIAL_DDIA_RELATIONSHIPS = [
  // Storage relationships
  { source: 'lsm_tree', target: 'sstable', label: 'uses', description: 'LSM-дерево сбрасывает данные из памяти в неизменяемые SSTables на диске.' },
  { source: 'lsm_tree', target: 'bloom_filter', label: 'uses', description: 'Bloom Filter предотвращает чтение ненужных SSTables при поиске отсутствующих ключей.' },
  { source: 'lsm_tree', target: 'compaction', label: 'requires', description: 'Уплотнение сжимает и объединяет устаревшие SSTables в фоновом режиме.' },
  { source: 'lsm_tree', target: 'b_tree', label: 'alternative_to', description: 'LSM быстрее на запись, тогда как B-Tree обеспечивает более предсказуемое чтение.' },
  { source: 'b_tree', target: 'wal', label: 'uses', description: 'B-деревья модифицируют страницы in-place, поэтому WAL необходим для защиты от краша.' },
  { source: 'column_storage', target: 'batch_processing', label: 'accelerates', description: 'Колоночный формат критически ускоряет агрегации в аналитических пакетах.' },

  // Replication relationships
  { source: 'single_leader', target: 'split_brain', label: 'risks', description: 'При сетевом сбое два узла могут одновременно объявить себя лидерами.' },
  { source: 'consensus_raft_paxos', target: 'split_brain', label: 'prevents', description: 'Алгоритмы консенсуса через кворумы предотвращают одновременный выбор двух лидеров.' },
  { source: 'consensus_raft_paxos', target: 'single_leader', label: 'enables', description: 'Raft/Paxos обеспечивают надежный автоматический выбор нового лидера (Failover).' },
  { source: 'multi_leader', target: 'vector_clocks', label: 'uses', description: 'Векторные часы помогают обнаруживать конкурентные изменения в разных датацентрах.' },
  { source: 'leaderless', target: 'quorum', label: 'relies_on', description: 'Dynamo-style системы используют кворумы W + R > N для гарантии чтения последней записи.' },
  { source: 'leaderless', target: 'vector_clocks', label: 'uses', description: 'В безлидерных системах версии конфликтующих записей разрешаются векторными часами.' },
  { source: 'fencing_token', target: 'split_brain', label: 'mitigates', description: 'Ограждающий токен отвергает команды от старого «зомби»-лидера.' },

  // Transactions & Consistency
  { source: 'acid', target: 'serializability', label: 'includes', description: 'Сериализуемость — высший уровень буквы I (Isolation) в ACID.' },
  { source: 'snapshot_isolation', target: 'phantom_read', label: 'partially_solves', description: 'Snapshot Isolation защищает от большинства фантомов, но уязвима к Write Skew.' },
  { source: 'serializability', target: 'phantom_read', label: 'solves', description: 'Сериализуемость (2PL или SSI) полностью устраняет фантомные чтения и Write Skew.' },
  { source: 'two_phase_commit', target: 'acid', label: 'implements', description: '2PC обеспечивает атомарность (буква A) распределённых транзакций.' },
  { source: 'two_phase_commit', target: 'consensus_raft_paxos', label: 'contrasts_with', description: '2PC блокируется при падении координатора, а консенсус продолжает работу при кворуме.' },

  // Distributed & CAP
  { source: 'linearizability', target: 'cap_theorem', label: 'defines_C_in', description: 'Буква C в CAP-теореме означает именно линеаризуемость (строгую свежесть).' },
  { source: 'linearizability', target: 'eventual_consistency', label: 'trades_off_with', description: 'Линеаризуемость даёт мгновенную согласованность ценой задержки и доступности.' },
  { source: 'clock_skew', target: 'linearizability', label: 'breaks', description: 'Рассинхронизация физических часов не позволяет полагаться на timestamps для порядка событий.' },
  { source: 'partitioning', target: 'two_phase_commit', label: 'necessitates', description: 'При разделении данных по шардам распределенные транзакции требуют координации 2PC.' },

  // Processing & Streams
  { source: 'change_data_capture', target: 'stream_processing', label: 'feeds_into', description: 'CDC превращает журнал транзакций базы данных в поток событий для Kafka/Flink.' },
  { source: 'event_sourcing', target: 'stream_processing', label: 'natural_fit_for', description: 'Событийная архитектура естественным образом транслируется в потоковую обработку.' },
  { source: 'batch_processing', target: 'stream_processing', label: 'complements', description: 'Пакетная обработка считает исторические срезы, а потоковая — обновления в реальном времени.' },
  { source: 'schema_evolution', target: 'change_data_capture', label: 'governs', description: 'Потоки изменений требуют строгих совместимых схем (Avro), чтобы консьюмеры не падали.' },
];
