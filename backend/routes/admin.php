<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\LogController;
use App\Http\Controllers\Admin\BillingController;
use App\Http\Controllers\Admin\DomainController;
use App\Http\Controllers\Admin\AdminsController;
use App\Http\Controllers\Admin\NodeHealthController;
use App\Http\Controllers\Admin\BoomerrIncidentController;
use App\Http\Controllers\Admin\EmailTemplateController;
use App\Http\Controllers\Admin\FeatureAnnouncementController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'ability:admin'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me/settings', [AuthController::class, 'updateSettings']);
    Route::post('/me/test-notification', [AuthController::class, 'sendTestNotification']);
    Route::post('/logout', [AuthController::class, 'logout']);
    
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/admins', [AdminsController::class, 'index']);
    Route::post('/admins', [AdminsController::class, 'store']);
    Route::get('/admins/{id}', [AdminsController::class, 'show']);
    Route::put('/admins/{id}', [AdminsController::class, 'update']);
    Route::delete('/admins/{id}', [AdminsController::class, 'destroy']);
    Route::get('/domains', [DomainController::class, 'index']);
    Route::get('/logs', [LogController::class, 'index']);
    Route::get('/logs/integrations', [LogController::class, 'integrationLogs']);
    Route::get('/logs/advanced', [LogController::class, 'advancedLogs']);
    Route::get('/billing', [BillingController::class, 'index']);
    Route::post('/billing/assign-custom-plan', [BillingController::class, 'assignCustomPlan']);

    // Email Templates & Sequence Automation
    Route::get('/email-templates', [EmailTemplateController::class, 'index']);
    Route::post('/email-templates', [EmailTemplateController::class, 'store']);
    Route::get('/email-templates/{idOrKey}', [EmailTemplateController::class, 'show']);
    Route::put('/email-templates/{idOrKey}', [EmailTemplateController::class, 'update']);
    Route::delete('/email-templates/{idOrKey}', [EmailTemplateController::class, 'destroy']);
    Route::post('/email-templates/{idOrKey}/preview', [EmailTemplateController::class, 'preview']);
    Route::post('/email-templates/{idOrKey}/test-send', [EmailTemplateController::class, 'testSend']);
    Route::post('/email-sequences/trigger-run', [EmailTemplateController::class, 'triggerRun']);

    // Boomerr Platform Status Management
    Route::get('/node-health', [NodeHealthController::class, 'index']);
    Route::get('/boomerr-incidents', [BoomerrIncidentController::class, 'index']);
    Route::post('/boomerr-incidents', [BoomerrIncidentController::class, 'store']);
    Route::get('/boomerr-incidents/{id}', [BoomerrIncidentController::class, 'show']);
    Route::put('/boomerr-incidents/{id}', [BoomerrIncidentController::class, 'update']);
    Route::delete('/boomerr-incidents/{id}', [BoomerrIncidentController::class, 'destroy']);

    // Feature Announcements Management
    Route::get('/features', [FeatureAnnouncementController::class, 'index']);
    Route::post('/features', [FeatureAnnouncementController::class, 'store']);
    Route::get('/features/{id}', [FeatureAnnouncementController::class, 'show']);
    Route::put('/features/{id}', [FeatureAnnouncementController::class, 'update']);
    Route::delete('/features/{id}', [FeatureAnnouncementController::class, 'destroy']);
    Route::post('/features/{id}/toggle-pin', [FeatureAnnouncementController::class, 'togglePin']);
    Route::post('/features/{id}/broadcast-email', [FeatureAnnouncementController::class, 'broadcastEmail']);
});