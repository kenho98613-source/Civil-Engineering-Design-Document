import { useEffect, useState } from 'react';
import { BenchmarkModal, CenterWorkspace } from './components/CenterWorkspace';
import { LeftStepPanel } from './components/LeftStepPanel';
import { RightKpiRail } from './components/RightKpiRail';
import { TopBar } from './components/TopBar';
import { useProjectStore } from './hooks/useProjectStore';

export default function App() {
  const store = useProjectStore();
  const [showBench, setShowBench] = useState(false);

  // Desktop keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (k === 'y') {
        e.preventDefault();
        store.redo();
      } else if (k === 's') {
        e.preventDefault();
        store.saveProjectDownload();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        projectTitle={store.state.jno}
        jobNo={store.state.pn}
        checkingMethod={store.state.acc}
        wallTabs={store.wallTabStatuses}
        activeWallIndex={store.project.active}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        theme={store.theme}
        reportMode={store.reportMode}
        toast={store.toast}
        onSelectWall={store.switchWallType}
        onAddWall={store.addWallType}
        onRenameWall={store.renameWallType}
        onDeleteWall={store.deleteWallType}
        onUndo={store.undo}
        onRedo={store.redo}
        onThemeChange={store.setTheme}
        onReportModeChange={store.setReportMode}
        onOpenFile={store.loadProjectText}
        onSaveFile={store.saveProjectDownload}
        onExportDxf={store.exportDxfSection}
        onLoadDefault={store.applyDefaultForCurrentForm}
        onOpenBenchmarks={() => setShowBench(true)}
        onReset={store.resetFactory}
        onAutoBars={() => store.runAutoBarsNow()}
        onExportPdf={() => window.print()}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftStepPanel
          state={store.state}
          result={store.result}
          activeStep={store.activeStep}
          onStepChange={store.setActiveStep}
          onCommit={store.commitState}
          onChangeWallForm={store.changeWallForm}
          onAutoBars={() => store.runAutoBarsNow()}
          onHoverField={store.setHoveredField}
        />

        <CenterWorkspace
          state={store.state}
          result={store.result}
          registerRows={store.registerRows}
          diagrams={store.diagrams}
          curtailments={store.curtailments}
          activeTab={store.activeTab}
          hoveredField={store.hoveredField}
          onTabChange={store.setActiveTab}
          onEditFigureParam={store.editFigureParam}
          onCommit={store.commitState}
          onAutoBars={store.runAutoBarsNow}
        />

        <RightKpiRail
          result={store.result}
          registerRows={store.registerRows}
          onJumpTab={store.setActiveTab}
          onJumpStep={store.setActiveStep}
        />
      </div>

      {showBench && <BenchmarkModal onClose={() => setShowBench(false)} />}
    </div>
  );
}
