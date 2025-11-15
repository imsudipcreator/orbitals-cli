"use client";

import LoginForm from "@/components/login-form";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const Login = () => {
    const router = useRouter();
    const { data, isPending } = authClient.useSession()
    if (isPending) {
        return (
            <div>
                <Spinner />
            </div>
        )
    }
    if (data?.session || data?.user) {
        router.push('/')
    }
    return (
        <div>
            <LoginForm />
        </div>
    )
}
export default Login