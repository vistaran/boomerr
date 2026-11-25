<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdminUserCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'boomerr:admin:create
                            {--name= : Name of the admin user}
                            {--email= : Email address of the admin user}
                            {--password= : Password for the admin user}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create or update an administrative user account for the Boomerr control panel';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = $this->option('name') ?: $this->ask('Admin Name', 'Administrator');
        $email = $this->option('email') ?: $this->ask('Admin Email');
        $password = $this->option('password') ?: $this->secret('Admin Password (min 8 characters)');

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
        ], [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }
            return self::FAILURE;
        }

        $admin = Admin::updateOrCreate(
            ['email' => strtolower(trim($email))],
            [
                'name' => trim($name),
                'password' => Hash::make($password),
            ]
        );

        $this->info("Admin user '{$admin->email}' successfully created/updated.");
        $this->line("You can now log in at /admin/login using this email and password.");

        return self::SUCCESS;
    }
}
