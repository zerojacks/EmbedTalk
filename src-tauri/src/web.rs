#[cfg(feature = "web")]
use axum::{
    routing::{get, post},
    Router,
    Json,
    extract::State,
};
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use crate::basefunc::protocol::FrameAnalisyic;
use crate::config::xmlconfig::{ProtocolConfigManager, ItemConfigList, GLOBAL_CSG13, GLOBAL_645, GLOBAL_CSG16, GLOBAL_Moudle, GLOBAL_MS};
use std::time::Instant;
use tracing::{error, info};

// 状态管理
#[derive(Default, Clone)]
pub struct AppState {
    region: Arc<RwLock<String>>,
}

// 请求和响应类型
#[derive(Debug, Deserialize)]
struct ParseTextRequest {
    message: String,
    region: String,
}

#[derive(Debug, Serialize)]
struct ParseResponse {
    data: Vec<serde_json::Value>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GetProtocolConfigRequest {
    item_id: String,
    protocol: String,
    region: String,
    dir: Option<u8>,
}

#[derive(Debug, Serialize)]
struct ProtocolListResponse {
    items: Vec<ItemConfigList>,
    error: Option<String>,
}

#[cfg(feature = "web")]
pub async fn start_web_server() {
    // 创建应用状态
    let state = AppState {
        region: Arc::new(RwLock::new("南网".to_string())),
    };

    // 创建CORS中间件
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 创建路由
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/parse", post(parse_text))
        .route("/api/region", get(get_region))
        .route("/api/region", post(set_region))
        .route("/api/protocol/config", post(get_protocol_config))
        .route("/api/protocol/list", get(get_protocol_list))
        .route("/api/protocol/list/csg13", get(get_csg13_list))
        .route("/api/protocol/list/csg16", get(get_csg16_list))
        .route("/api/protocol/list/dlt645", get(get_dlt645_list))
        .route("/api/protocol/list/module", get(get_module_list))
        .with_state(state)
        .layer(cors);

    // 绑定地址
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Web server listening on {}", addr);

    // 启动服务器
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// 健康检查接口
async fn health_check() -> &'static str {
    "OK"
}

// 获取协议配置
async fn get_protocol_config(
    Json(payload): Json<GetProtocolConfigRequest>,
) -> Json<serde_json::Value> {
    if let Some(config) = ProtocolConfigManager::get_config_xml(
        &payload.item_id,
        &payload.protocol,
        &payload.region,
        payload.dir,
    ) {
        Json(serde_json::to_value(config).unwrap_or_default())
    } else {
        Json(serde_json::Value::Null)
    }
}

// 获取所有协议列表
async fn get_protocol_list() -> Json<ProtocolListResponse> {
    let mut all_items = Vec::new();
    
    // 收集CSG13协议项
    if let Ok(csg13) = &*GLOBAL_CSG13 {
        let items = csg13.get_all_item().await;
        all_items.extend(items);
    }
    
    // 收集CSG16协议项
    if let Ok(csg16) = &*GLOBAL_CSG16 {
        let items = csg16.get_all_item().await;
        all_items.extend(items);
    }
    
    // 收集DLT645协议项
    if let Ok(dlt645) = &*GLOBAL_645 {
        let items = dlt645.get_all_item().await;
        all_items.extend(items);
    }
    
    // 收集模块协议项
    if let Ok(module) = &*GLOBAL_Moudle {
        let items = module.get_all_item().await;
        all_items.extend(items);
    }
    
    Json(ProtocolListResponse {
        items: all_items,
        error: None,
    })
}

// 获取CSG13协议列表
async fn get_csg13_list() -> Json<ProtocolListResponse> {
    if let Ok(csg13) = &*GLOBAL_CSG13 {
        let items = csg13.get_all_item().await;
        return Json(ProtocolListResponse {
            items,
            error: None,
        });
    }
    Json(ProtocolListResponse {
        items: Vec::new(),
        error: Some("Failed to get CSG13 protocol list".to_string()),
    })
}

// 获取CSG16协议列表
async fn get_csg16_list() -> Json<ProtocolListResponse> {
    if let Ok(csg16) = &*GLOBAL_CSG16 {
        let items = csg16.get_all_item().await;
        return Json(ProtocolListResponse {
            items,
            error: None,
        });
    }
    Json(ProtocolListResponse {
        items: Vec::new(),
        error: Some("Failed to get CSG16 protocol list".to_string()),
    })
}

// 获取DLT645协议列表
async fn get_dlt645_list() -> Json<ProtocolListResponse> {
    if let Ok(dlt645) = &*GLOBAL_645 {
        let items = dlt645.get_all_item().await;
        return Json(ProtocolListResponse {
            items,
            error: None,
        });
    }
    Json(ProtocolListResponse {
        items: Vec::new(),
        error: Some("Failed to get DLT645 protocol list".to_string()),
    })
}

// 获取模块协议列表
async fn get_module_list() -> Json<ProtocolListResponse> {
    if let Ok(module) = &*GLOBAL_Moudle {
        let items = module.get_all_item().await;
        return Json(ProtocolListResponse {
            items,
            error: None,
        });
    }
    Json(ProtocolListResponse {
        items: Vec::new(),
        error: Some("Failed to get Module protocol list".to_string()),
    })
}

// 解析报文
async fn parse_text(
    State(state): State<AppState>,
    Json(payload): Json<ParseTextRequest>,
) -> Json<ParseResponse> {
    use std::panic;

    if payload.message.is_empty() {
        return Json(ParseResponse {
            data: Vec::new(),
            error: Some("Invalid hex message".to_string()),
        });
    }

    let start_time = Instant::now();
    info!("Received message: {} {}", payload.message, payload.region);

    let result = panic::catch_unwind(|| {
        let message_cleaned = payload.message.replace(' ', "").replace('\n', "");
        if !message_cleaned.chars().all(|c| c.is_digit(16)) || message_cleaned.len() % 2 != 0 {
            info!("Invalid hex message: {}", payload.message);
            return ParseResponse {
                data: Vec::new(),
                error: Some("Invalid hex message".to_string()),
            };
        }

        let frame = hex::decode(&message_cleaned).unwrap_or_default();
        info!(
            "Frame: {:?} duration: {:?}",
            frame,
            start_time.elapsed().as_millis()
        );
        let processed_result = FrameAnalisyic::process_frame(&frame, &payload.region);
        info!("Result: {:?}", processed_result);

        ParseResponse {
            data: processed_result,
            error: None,
        }
    });

    match result {
        Ok(response) => {
            let duration = start_time.elapsed();
            info!("parse_text duration: {:?}", duration.as_millis());
            Json(response)
        }
        Err(e) => {
            error!("parse_text panic: {:?}", e);
            Json(ParseResponse {
                data: Vec::new(),
                error: Some("An error occurred".to_string()),
            })
        }
    }
}

// 获取区域值
async fn get_region(State(state): State<AppState>) -> Json<String> {
    let region = state.region.read().await;
    Json(region.to_string())
}

// 设置区域值
async fn set_region(
    State(state): State<AppState>,
    Json(new_region): Json<String>,
) -> Json<String> {
    let mut region = state.region.write().await;
    *region = new_region;
    Json(region.to_string())
} 