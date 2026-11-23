import {Alert,Box,CircularProgress,Button} from '@mui/material';
export function Loading(){return <Box className="loading"><CircularProgress size={24}/><span>Loading secure banking data…</span></Box>}
export function ErrorState({error,onRetry}){return <Alert severity="error" action={onRetry?<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>:null}>{error?.message||'Unable to load data.'}</Alert>}
export function Empty({text='No records found.'}){return <Box className="empty-state">{text}</Box>}
