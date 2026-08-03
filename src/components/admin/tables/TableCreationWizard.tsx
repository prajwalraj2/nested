// src/components/admin/tables/TableCreationWizard.tsx

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Eye,
  Loader2,
  Target,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

import { DomainPageSelector } from '@/components/admin/tables/DomainPageSelector';
import { TableSchemaEditor } from '@/components/admin/tables/TableSchemaEditor';
import { CSVUploadInterface } from '@/components/admin/tables/CSVUploadInterface';
import { TablePreview } from '@/components/admin/tables/TablePreview';

import type { 
  TableCreationState, 
  TableCreationStep,
  TableSchema,
  TableData,
  TableSettings
} from '@/types/table';

/**
 * Table Creation Wizard Component
 * 
 * Multi-step wizard that guides users through creating a new data table:
 * 1. Domain/Page Selection
 * 2. Schema Definition  
 * 3. Data Upload (Optional)
 * 4. Preview & Save
 * 
 * Features:
 * - Step-by-step navigation
 * - Form validation at each step
 * - Progress tracking
 * - Error handling and recovery
 * - Save as draft functionality
 */

// Type definitions
type Domain = {
  id: string;
  name: string;
  slug: string;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    contentType: string;
    table?: {
      id: string;
      name: string;
    } | null;
  }>;
};

type TableCreationWizardProps = {
  domains: Domain[];
};

/**
 * ⚠️ `icon` is a `LucideIcon` COMPONENT, not an emoji string (G-5d).
 *
 * The emoji it replaces (🎯 📋 📤 👁️) could not inherit `currentColor`, so they ignored the
 * theme entirely — the same reason the sidebar icons were replaced in G-1 and the dashboard's
 * in G-2. Typing it as `LucideIcon` also makes a bad icon a compile error rather than a glyph
 * that silently renders as a box on some platforms.
 */
const STEPS: Array<{
  id: TableCreationStep;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'select-page',
    title: 'Select page',
    description: 'Choose the domain and page for your table',
    icon: Target
  },
  {
    id: 'define-schema',
    title: 'Define schema',
    description: 'Configure columns and data types',
    icon: Columns3
  },
  {
    id: 'upload-data',
    title: 'Upload data',
    description: 'Import CSV data (optional)',
    icon: Upload
  },
  {
    id: 'preview',
    title: 'Preview',
    description: 'Review and save your table',
    icon: Eye
  }
];

export function TableCreationWizard({ domains }: TableCreationWizardProps) {
  const router = useRouter();
  
  // Wizard state
  const [state, setState] = useState<TableCreationState>({
    step: 'select-page',
    errors: [],
    isLoading: false,
  });

  // Navigation helpers
  const currentStepIndex = STEPS.findIndex(step => step.id === state.step);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Step navigation
  const goToStep = useCallback((step: TableCreationStep) => {
    setState(prev => ({ ...prev, step, errors: [] }));
  }, []);

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      goToStep(STEPS[nextIndex].id);
    }
  }, [currentStepIndex, goToStep]);

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(STEPS[prevIndex].id);
    }
  }, [currentStepIndex, goToStep]);

  // State update handlers
  const updateState = useCallback((updates: Partial<TableCreationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Domain/Page selection handler
  const handlePageSelection = useCallback((domainData: any, pageData: any) => {
    updateState({
      selectedDomain: domainData,
      selectedPage: pageData,
    });
  }, [updateState]);

  // Schema definition handler
  const handleSchemaDefinition = useCallback((schema: TableSchema, settings: TableSettings) => {
    updateState({
      tableSchema: schema,
      tableSettings: settings,
    });
  }, [updateState]);

  // Data upload handler
  const handleDataUpload = useCallback((data: TableData, file?: File) => {
    updateState({
      tableData: data,
      csvFile: file,
    });
  }, [updateState]);

  // Final save handler
  const handleSave = useCallback(async () => {
    if (!state.selectedPage || !state.tableSchema) {
      updateState({ 
        errors: ['Missing required data. Please complete all steps.'] 
      });
      return;
    }

    updateState({ isLoading: true, errors: [] });

    try {
      const response = await fetch('/api/admin/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${state.selectedPage.title} Table`,
          pageId: state.selectedPage.id,
          schema: state.tableSchema,
          data: state.tableData || { rows: [], metadata: { totalRows: 0, lastUpdated: new Date().toISOString() } },
          settings: state.tableSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create table');
      }

      const result = await response.json();
      
      // Redirect to the table management page
      router.push(`/admin/tables/${result.table.id}`);
      
    } catch (error) {
      console.error('Error creating table:', error);
      updateState({ 
        errors: ['Failed to create table. Please try again.'],
        isLoading: false 
      });
    }
  }, [state, updateState, router]);

  // Validation helpers
  const canProceedFromStep = (step: TableCreationStep): boolean => {
    switch (step) {
      case 'select-page':
        return !!(state.selectedDomain && state.selectedPage);
      case 'define-schema':
        return !!(state.tableSchema && state.tableSchema.columns.length > 0);
      case 'upload-data':
        return true; // Optional step
      case 'preview':
        return !!(state.selectedPage && state.tableSchema);
      default:
        return false;
    }
  };

  const CurrentStepIcon = STEPS[currentStepIndex].icon;

  return (
    /*
      ⚠️ FULL WIDTH — no `max-w-*`, on the user's instruction.

      G-5d(i) narrowed this to `max-w-4xl` on the theory that a form reads badly at full
      width. In practice the steps are not forms: step 1 is a grid of domain cards, step 2 a
      list of pages, step 3 a CSV preview table and step 4 a column list — all of which want
      the room. The centred column left large empty margins and squeezed the tables.

      The admin shell already supplies the page padding, so this just stops fighting it.
    */
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CurrentStepIcon className="size-4" aria-hidden="true" />
              {STEPS[currentStepIndex].title}
            </CardTitle>
            <Badge variant="outline" className="shrink-0 font-normal">
              Step {currentStepIndex + 1} of {STEPS.length}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-muted-foreground flex justify-between gap-2 text-sm">
              <span>{STEPS[currentStepIndex].description}</span>
              {/* `shrink-0` so the percentage never wraps under a long description. */}
              <span className="shrink-0">{Math.round(progress)}%</span>
            </div>
            {/*
              `aria-label` because a bare `Progress` announces a number with no indication of
              what it measures.
            */}
            <Progress value={progress} aria-label="Wizard progress" />
          </div>

          {/*
            Step indicators. Was three hardcoded blue/grey states
            (`bg-blue-600 text-white border-blue-600` / `border-blue-600 text-blue-600` /
            `border-gray-300 text-gray-400`) — none of which followed the theme.

            Now `primary` for done and current, `muted-foreground` for pending, so the whole
            row derives from the palette.
          */}
          <ol className="flex items-center justify-between gap-2">
            {STEPS.map((step, index) => {
              const isDone = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <li
                  key={step.id}
                  className={
                    'flex items-center gap-2 ' +
                    (isDone || isCurrent ? 'text-foreground' : 'text-muted-foreground')
                  }
                  // Announces which step is active to assistive tech, which the original's
                  // colour-only distinction did not.
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className={
                      'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium ' +
                      (isDone
                        ? 'bg-primary text-primary-foreground border-primary'
                        : isCurrent
                          ? 'border-primary text-primary'
                          : 'text-muted-foreground')
                    }
                  >
                    {/* A lucide `Check`, replacing a `✓` text character. */}
                    {isDone ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="hidden text-sm font-medium sm:inline">{step.title}</span>
                </li>
              );
            })}
          </ol>
        </CardHeader>
      </Card>

      {/*
        Errors. Was a `Card` with `border-red-200 bg-red-50 text-red-700` and a ⚠️ emoji —
        light-only, and it duplicated what shadcn's destructive `Alert` already provides.
      */}
      {state.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            <ul className="space-y-1">
              {/*
                ⚠️ Keyed on the message rather than the array index. Index keys on a list that
                is rebuilt on every validation pass make React reuse the wrong nodes.
              */}
              {state.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/*
        ⚠️ NAVIGATION MOVED INTO THIS CARD as a footer (it was a third stacked `Card` of its
        own). Three cards for progress / content / two buttons meant the actual step content
        was sandwiched in chrome, and on the shorter steps the buttons sat below the fold for
        no reason.
      */}
      <Card>
        <CardContent>

          {state.step === 'select-page' && (
            <DomainPageSelector
              domains={domains}
              selectedDomain={state.selectedDomain}
              selectedPage={state.selectedPage}
              onSelection={handlePageSelection}
            />
          )}

          {state.step === 'define-schema' && (
            <TableSchemaEditor
              schema={state.tableSchema}
              settings={state.tableSettings}
              onUpdate={handleSchemaDefinition}
            />
          )}

          {state.step === 'upload-data' && (
            <CSVUploadInterface
              schema={state.tableSchema!}
              existingData={state.tableData}
              onDataUpload={handleDataUpload}
            />
          )}

          {state.step === 'preview' && (
            <TablePreview
              domain={state.selectedDomain!}
              page={state.selectedPage!}
              schema={state.tableSchema!}
              data={state.tableData}
              settings={state.tableSettings}
            />
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStepIndex === 0 || state.isLoading}
            >
              {/* lucide chevrons, replacing `←` / `→` text arrows that rendered at a
                  different weight and baseline on every platform. */}
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>

            {state.step !== 'preview' ? (
              <Button
                onClick={nextStep}
                disabled={!canProceedFromStep(state.step) || state.isLoading}
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              /*
                ⚠️ `className="bg-green-600 hover:bg-green-700"` REMOVED. The final button was
                hardcoded green — which ignored the theme, and set it apart from every other
                primary action in the admin for no reason. It is the primary action on this
                step; the default primary style is what says that.
              */
              <Button
                onClick={handleSave}
                disabled={!canProceedFromStep(state.step) || state.isLoading}
              >
                {state.isLoading && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                {state.isLoading ? 'Creating…' : 'Create table'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
