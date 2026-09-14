import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#145b82",
      light: "#477da0",
      dark: "#104565",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#203139",
      contrastText: "#f1f5f9",
    },
    background: {
      default: "#f5f7f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#203139",
      secondary: "#566572",
    },
    divider: "#dce3e7",
    error: { main: "#dc2626" },
    warning: { main: "#925b13" },
    success: { main: "#247458" },
    info: { main: "#28648c" },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { fontWeight: 600, fontFamily: "'Inter', system-ui, sans-serif" },
    h2: { fontFamily: "'Inter', system-ui, sans-serif" },
    h3: { fontFamily: "'Inter', system-ui, sans-serif" },
    h4: { fontFamily: "'Inter', system-ui, sans-serif" },
    h5: { fontFamily: "'Inter', system-ui, sans-serif" },
    h6: { fontFamily: "'Inter', system-ui, sans-serif" },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButtonBase: { styleOverrides: { root: { "&.Mui-focusVisible": { outline: "3px solid #145b82", outlineOffset: 3 } } } },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
          fontFamily: "'Inter', system-ui, sans-serif",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #dce3e7",
          borderRadius: "12px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#f5f7f8",
          fontWeight: 600,
          fontSize: "0.8125rem",
          letterSpacing: "0",
          textTransform: "none",
          color: "#566572",
          borderBottom: "2px solid #dce3e7",
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: "10px 16px",
        },
        root: {
          borderColor: "#dce3e7",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
          padding: "12px 16px",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.MuiTableRow-hover:hover": {
            backgroundColor: "#faf8f4",
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          border: "1px solid #dce3e7",
          boxShadow: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: "6px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.72rem",
          fontWeight: 500,
          height: "24px",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "14px",
          border: "1px solid #dce3e7",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: "1rem",
          padding: "20px 24px 12px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 24px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
          gap: "8px",
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          borderColor: "#81929d",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "10px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: "3px",
          height: "6px",
          backgroundColor: "#dce3e7",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 500,
          fontSize: "0.875rem",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: "#145b82",
          height: "2px",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 40, minHeight: 40,
          borderRadius: "8px",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderLeft: "1px solid #dce3e7",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.75rem",
          borderRadius: "6px",
          backgroundColor: "#203139",
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: "8px",
          paddingBlock: "8px",
        },
        spacer: { flex: "1 1 0%" },
        selectLabel: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
          margin: 0,
        },
        displayedRows: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
          margin: 0,
        },
        actions: { marginLeft: 0 },
        root: {
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "0.8rem",
          borderTop: "1px solid #dce3e7",
        },
      },
    },
  },
});

export default theme;
