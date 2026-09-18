import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { X, Maximize2 } from 'lucide-react';
import mermaid from 'mermaid';
import DiagramModal from './DiagramModal';

const DDIA_GRAPH = `
graph TD
    DataSystems[Data Systems] --> Reliability[Reliability]
    DataSystems --> Scalability[Scalability]
    DataSystems --> Maintainability[Maintainability]
    
    DataSystems --> DataModels[Data Models]
    DataModels --> Relational[Relational]
    DataModels --> Document[Document / NoSQL]
    DataModels --> GraphModel[Graph]
    
    DataSystems --> Storage[Storage & Retrieval]
    Storage --> SSTables[SSTables & LSM-Trees]
    Storage --> BTree[B-Trees]
    
    DataSystems --> Distributed[Distributed Data]
    Distributed --> Replication[Replication]
    Distributed --> Partitioning[Partitioning / Sharding]
    Distributed --> Transactions[Transactions]
    
    Replication --> LeaderBased[Leader-based]
    Replication --> MultiLeader[Multi-leader]
    Replication --> Leaderless[Leaderless]
    
    Transactions --> ACID[ACID Properties]
    Transactions --> Serializability[Serializability]
    
    Distributed --> Consensus[Consistency & Consensus]
    Consensus --> Linearizability[Linearizability]
    Consensus --> 2PC[2-Phase Commit]
    
    DataSystems --> DerivedData[Derived Data]
    DerivedData --> Batch[Batch Processing]
    DerivedData --> Stream[Stream Processing]
    
    classDef default fill:#1e1e2d,stroke:#818cf8,stroke-width:1px,color:#fff;
    classDef root fill:#6366f1,stroke:#818cf8,stroke-width:2px,color:#fff;
    class DataSystems root;
`;

export default function ConceptGraphModal() {
  const { isGraphOpen, setGraphOpen } = useStore();
  const [svg, setSvg] = useState('');
  const [isFullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isGraphOpen && !svg) {
      mermaid.render('global_concept_graph', DDIA_GRAPH).then(({ svg: renderedSvg }) => {
        setSvg(renderedSvg);
      }).catch(console.error);
    }
  }, [isGraphOpen, svg]);

  if (!isGraphOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-bgMain border border-borderColor rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-borderColor bg-bgSidebar">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Граф Концепций (Knowledge Map)</h2>
              <p className="text-xs text-textDim mt-1">Визуальная структура ключевых тем книги</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setFullscreen(true)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-borderColor bg-white/5 hover:bg-white/10 text-textMain hover:text-white transition-colors flex items-center gap-2"
                title="На весь экран"
              >
                <Maximize2 size={16} />
                <span className="hidden sm:inline text-sm">Увеличить</span>
              </button>
              <button 
                onClick={() => setGraphOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-textDim hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 bg-[#0a0d14] flex items-center justify-center custom-scrollbar">
            {svg ? (
              <div 
                className="w-full h-full flex items-center justify-center cursor-zoom-in"
                onClick={() => setFullscreen(true)}
                dangerouslySetInnerHTML={{ __html: svg }} 
              />
            ) : (
              <div className="spinner"></div>
            )}
          </div>
        </div>
      </div>

      <DiagramModal 
        isOpen={isFullscreen}
        onClose={() => setFullscreen(false)}
        svgContent={svg}
        title="Граф Концепций: DDIA"
      />
    </>
  );
}
