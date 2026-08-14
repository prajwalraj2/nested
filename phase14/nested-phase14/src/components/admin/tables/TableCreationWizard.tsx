// src/components/admin/tables/TableCreationWizard.tsx

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

const STEPS: Array<{
  id: TableCreationStep;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'select-page',
    title: 'Select Page',
    description: 'Choose domain and page for your table',
    icon: '🎯'
  },
  {
    id: 'define-schema',
    title: 'Define Schema',
    description: 'Configure columns and data types',
    icon: '📋'
  },
  {
    id: 'upload-data',
    title: 'Upload Data',
    description: 'Import CSV data (optional)',
    icon: '📤'
  },
  {
    id: 'preview',
    title: 'Preview',
    description: 'Review and save your table',
    icon: '👁️'
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

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* Progress Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-xl">
              {STEPS[currentStepIndex].icon} {STEPS[currentStepIndex].title}
            </CardTitle>
            <Badge variant="outline">
              Step {currentStepIndex + 1} of {STEPS.length}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{STEPS[currentStepIndex].description}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
          
          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step, index) => (
              <div 
                key={step.id}
                className={`flex items-center ${
                  index <= currentStepIndex 
                    ? 'text-blue-600' 
                    : 'text-gray-400'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                  index < currentStepIndex 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : index === currentStepIndex
                      ? 'border-blue-600 text-blue-600'
                      : 'border-gray-300 text-gray-400'
                }`}>
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:inline">
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {state.errors.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-700">
              <span className="text-xl">⚠️</span>
              <div>
                <h4 className="font-medium">There were some errors:</h4>
                <ul className="text-sm mt-1 space-y-1">
                  {state.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          
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

        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStepIndex === 0 || state.isLoading}
            >
              ← Previous
            </Button>
            
            <div className="flex space-x-2">
              {state.step !== 'preview' ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceedFromStep(state.step) || state.isLoading}
                >
                  Next →
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={!canProceedFromStep(state.step) || state.isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {state.isLoading ? 'Creating...' : '✓ Create Table'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
