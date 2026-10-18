// GET /api/customer/session — Get current session info
import { customerSessionResponse } from './response';


export async function GET() {
    return customerSessionResponse();
}
